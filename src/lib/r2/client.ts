import "server-only";

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
 * A URL that serves one object for two minutes. The file name travels in the
 * response's Content-Disposition so the browser tab and any download carry
 * the name the client gave the file, not the uuid it is stored under.
 */
export async function presignDownload(input: {
  key: string;
  fileName?: string;
  contentType?: string;
}): Promise<{ url: string; expiresIn: number }> {
  const { client, bucket } = getR2();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: input.key,
    ResponseContentType: input.contentType,
    ResponseContentDisposition: input.fileName
      ? `inline; filename="${asciiFileName(input.fileName)}"; filename*=UTF-8''${encodeURIComponent(input.fileName)}`
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

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === "NotFound" || e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404;
}

/** The plain ASCII fallback of a file name for the first `filename=` parameter. */
function asciiFileName(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "");
  return ascii || "file";
}
