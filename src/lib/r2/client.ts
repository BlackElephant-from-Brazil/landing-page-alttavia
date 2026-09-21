import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { contentDisposition } from "./keys";

/**
 * The private bucket where a client's documents live: Cloudflare R2, spoken
 * to through the S3 API. Server only, like the Supabase admin client, because
 * the access key can read every file of every order.
 *
 * The browser never talks to this module. It receives a presigned URL from
 * a route handler and PUTs the file straight to the bucket; the route then
 * asks the bucket what actually arrived (HeadObject) before it believes the
 * upload.
 *
 * One kind of file is written and read from here rather than by a browser:
 * the service agreement the server generates after payment. putObject stores
 * it; getObjectBytes reads it back, to attach it to an email again
 * (src/lib/contracts/ensure.ts) and to stream it to its owner
 * (GET /api/orders/[id]/contract), which answers the PDF itself instead of a
 * redirect to a presigned URL: a tab that is refreshed after two minutes
 * must still show the agreement, not the bucket's XML for an expired link.
 *
 * Environment is read lazily, inside the functions, so importing this module
 * in a build or a test never throws for a missing key.
 */

const PRESIGN_UPLOAD_SECONDS = 300;
const PRESIGN_DOWNLOAD_SECONDS = 120;

type R2 = { client: S3Client; bucket: string };

let cached: R2 | null = null;

function readConfig() {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || "auto";
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set. See .env.example.",
    );
  }
  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
}

/** The S3 client and bucket name, built once per process. */
export function getR2(): R2 {
  if (cached) return cached;
  const { endpoint, region, bucket, accessKeyId, secretAccessKey } = readConfig();
  const client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    // R2 addresses buckets by path, not by subdomain.
    forcePathStyle: true,
    // Newer SDKs add a CRC32 checksum header to every PutObject and expect
    // one back. R2 does not speak that, and a presigned PUT from a browser
    // could never carry it anyway, so both sides are left to "when required".
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  cached = { client, bucket };
  return cached;
}

/**
 * A URL the browser can PUT one file to, for five minutes.
 *
 * `Content-Type` and `Content-Length` are part of the signature. The presigner
 * leaves `content-type` unsigned by default, so it is listed in
 * `signableHeaders` explicitly; without that the URL would accept any type.
 * The browser sends exactly the type it was told and the length of the file it
 * picked, and the object cannot be swapped for a bigger or different one.
 */
export async function presignUpload(input: {
  key: string;
  contentType: string;
  contentLength: number;
}): Promise<{ url: string; expiresIn: number }> {
  const { client, bucket } = getR2();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    ContentType: input.contentType,
    ContentLength: input.contentLength,
  });
  const url = await getSignedUrl(client, command, {
    expiresIn: PRESIGN_UPLOAD_SECONDS,
    signableHeaders: new Set(["content-type", "content-length"]),
  });
  return { url, expiresIn: PRESIGN_UPLOAD_SECONDS };
}

/**
 * Writes one object from the server, for a file the server made itself (the
 * service agreement). `ContentType` is stored with the object, so a download
 * that names no type of its own is still served as what it is.
 */
export async function putObject(input: { key: string; body: Uint8Array; contentType: string }): Promise<void> {
  const { client, bucket } = getR2();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      ContentLength: input.body.byteLength,
    }),
  );
}

/**
 * The bytes of one object, or null when it does not exist. For a file the
 * server reads back itself: the agreement, attached again when its email is
 * retried and streamed to its owner by the contract route. The whole object
 * is read into memory, which suits a PDF of a hundred kilobytes and nothing
 * much bigger. Any other failure is thrown, as in headObjectSize.
 */
export async function getObjectBytes(key: string): Promise<Uint8Array | null> {
  const { client, bucket } = getR2();
  try {
    const found = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!found.Body) return null;
    return await found.Body.transformToByteArray();
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/**
 * A URL that serves one object for two minutes. The file name travels in the
 * response's Content-Disposition so the browser tab and any download carry
 * the name the client gave the file, not the uuid it is stored under.
 *
 * `disposition` is `inline` unless said otherwise, so the browser shows what
 * it can show; `attachment` makes it save the file instead. A disposition
 * without a file name is sent only for `attachment`, because a bare `inline`
 * is what a browser does anyway.
 */
export async function presignDownload(input: {
  key: string;
  fileName?: string;
  contentType?: string;
  disposition?: "inline" | "attachment";
}): Promise<{ url: string; expiresIn: number }> {
  const { client, bucket } = getR2();
  const disposition = input.disposition ?? "inline";
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: input.key,
    ResponseContentType: input.contentType,
    ResponseContentDisposition: input.fileName
      ? contentDisposition(disposition, input.fileName)
      : disposition === "attachment"
        ? "attachment"
        : undefined,
  });
  const url = await getSignedUrl(client, command, { expiresIn: PRESIGN_DOWNLOAD_SECONDS });
  return { url, expiresIn: PRESIGN_DOWNLOAD_SECONDS };
}

/**
 * The size of an object in bytes, or null when it does not exist. Any other
 * failure (credentials, network) is thrown so the caller does not mistake an
 * outage for a missing upload.
 */
export async function headObjectSize(key: string): Promise<number | null> {
  const { client, bucket } = getR2();
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return typeof head.ContentLength === "number" ? head.ContentLength : null;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/**
 * Removes one object, for a file the firm returned by mistake
 * (DELETE /api/admin/deliverables/[id]). Deleting a key that is not there is
 * not an error in S3 or R2, so a retry after a half finished removal is safe.
 * Any other failure is thrown, as in headObjectSize.
 */
export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = getR2();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === "NotFound" || e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404;
}
