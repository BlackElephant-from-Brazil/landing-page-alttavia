#!/usr/bin/env node
/**
 * Puts Patrícia's digitised signature where the service agreements find it:
 * the bucket key firm/signature.png. From then on every agreement prepared
 * or regenerated carries it above the Second Party's signature line
 * (src/lib/contracts/ensure.ts reads it, src/lib/contracts/generate.ts draws
 * it about 40 mm wide). An agreement prepared before keeps its blank line
 * until the firm regenerates it from the order.
 *
 *   node scripts/firm-signature.mjs <signature.png>             check the file and upload it
 *   node scripts/firm-signature.mjs <signature.png> --dry-run   check the file only
 *
 * What the file must be: a PNG under 2 MB that pdf-lib can embed. A
 * transparent background is best: a white one covers the line it sits on,
 * and the script says so. Crop it close to the ink; the generator scales
 * what it gets, margins included.
 *
 * What is uploaded is at most 600 x 300 pixels (review of 2026-09-25). Every
 * agreement embeds the image, and anyone holding the PDF can extract it at
 * the size it was embedded, so it carries no more detail than the print
 * uses: 600 pixels across the 40 mm it is printed at is about 380 dpi. A
 * larger 8 bit PNG is shrunk here by a whole factor (scripts/lib/png.mjs,
 * which also drops whatever else the file carried) and the new size is
 * printed; any other larger PNG is refused with a line asking for a smaller
 * one. src/lib/contracts/generate.ts refuses a larger image too
 * (FIRM_SIGNATURE_MAX_PIXELS), so one put in the bucket another way is left
 * off the agreements, with a log line, rather than embedded.
 *
 * To preview it on a contract before uploading:
 *   npm run contract:preview -- --filled --signature <signature.png>
 *
 * Reads the S3_* variables from .env.local (the readEnvFile pattern of
 * scripts/stripe-setup.mjs; an exported variable wins) and prints no secret.
 * Uploading again replaces the file.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PDFDocument } from "pdf-lib";

import { fitPng, isPng, pngHeader } from "./lib/png.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The key ensure.ts reads (FIRM_SIGNATURE_KEY there). */
const KEY = "firm/signature.png";
const MAX_BYTES = 2 * 1024 * 1024;
/** The largest image uploaded, in pixels: FIRM_SIGNATURE_MAX_PIXELS in src/lib/contracts/generate.ts. */
const MAX_WIDTH = 600;
const MAX_HEIGHT = 300;

/**
 * Minimal .env reader. An explicit environment variable still wins, so CI can
 * override without editing a file.
 */
function readEnvFile(name) {
  const values = {};
  let source;
  try {
    source = readFileSync(join(ROOT, name), "utf8");
  } catch {
    return values;
  }
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (value) values[match[1]] = value;
  }
  return values;
}

const fileEnv = readEnvFile(".env.local");
const env = (name) => process.env[name] || fileEnv[name];

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

/**
 * Every reason the file cannot be the signature, or what to upload when it
 * can: the bytes (shrunk when the file is larger than MAX_WIDTH x
 * MAX_HEIGHT), their header, the size the file came in and whether it has
 * transparency.
 */
async function check(path) {
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch {
    fail(`Cannot read ${path}.`);
  }
  if (bytes.length === 0) fail(`${path} is empty.`);
  if (bytes.length > MAX_BYTES) fail(`${path} is ${(bytes.length / 1024 / 1024).toFixed(1)} MB. Keep it under 2 MB: crop it and save it smaller.`);
  if (!isPng(bytes)) fail(`${path} is not a PNG file. Save the signature as PNG, ideally with a transparent background.`);

  let header;
  try {
    header = pngHeader(bytes, path);
  } catch (error) {
    fail(error.message);
  }
  const original = { width: header.width, height: header.height };
  // Colour types 4 (grey + alpha) and 6 (RGBA) carry transparency; a tRNS chunk can too, which is rare in a scan.
  const transparent = header.colorType === 4 || header.colorType === 6 || bytes.includes(Buffer.from("tRNS"));

  let out = bytes;
  try {
    const fitted = fitPng(bytes, MAX_WIDTH, MAX_HEIGHT, path);
    out = fitted.bytes;
    if (fitted.shrunk) header = pngHeader(out, path);
  } catch (error) {
    fail(
      `${path} is ${original.width} x ${original.height} pixels and cannot be shrunk here (${error.message}). ` +
        `Resize it to at most ${MAX_WIDTH} x ${MAX_HEIGHT} pixels, save it as PNG and run this again.`,
    );
  }
  if (header.width < 50 || header.height < 20) fail(`${path} is ${header.width} x ${header.height} pixels: too small to print sharp.`);

  // What the generator will do with it: embed it with pdf-lib. A file it refuses here would be refused there.
  try {
    const doc = await PDFDocument.create();
    await doc.embedPng(new Uint8Array(out));
  } catch (error) {
    fail(`pdf-lib cannot embed ${path}: ${error.message}`);
  }
  return { bytes: out, header, original, transparent };
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const path = argv.find((arg) => !arg.startsWith("--"));
  if (!path) fail("Usage: node scripts/firm-signature.mjs <signature.png> [--dry-run]");

  const absolute = resolve(path);
  const { bytes, header, original, transparent } = await check(absolute);
  if (original.width !== header.width || original.height !== header.height) {
    console.log(
      `${absolute}: PNG, ${original.width} x ${original.height} px, shrunk to ${header.width} x ${header.height} px ` +
        `(${(bytes.length / 1024).toFixed(1)} kB) so the agreements carry no sharper copy than the print needs.`,
    );
  } else {
    console.log(`${absolute}: PNG, ${header.width} x ${header.height} px, ${(bytes.length / 1024).toFixed(1)} kB.`);
  }
  if (!transparent) {
    console.warn("  ! No transparency: the background will cover the signature line. A transparent PNG looks better.");
  }
  if (dryRun) {
    console.log("Dry run: nothing uploaded.");
    return;
  }

  const endpoint = env("S3_ENDPOINT");
  const bucket = env("S3_BUCKET");
  const accessKeyId = env("S3_ACCESS_KEY_ID");
  const secretAccessKey = env("S3_SECRET_ACCESS_KEY");
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    fail("Missing in .env.local: S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
  }
  const client = new S3Client({
    endpoint,
    region: env("S3_REGION") || "auto",
    credentials: { accessKeyId, secretAccessKey },
    // R2 addresses buckets by path, and does not speak the SDK's default checksums (src/lib/r2/client.ts).
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: KEY,
        Body: bytes,
        ContentType: "image/png",
        ContentLength: bytes.length,
      }),
    );
  } catch (error) {
    fail(`The upload failed: ${error.name ?? "Error"}${error.message ? `: ${error.message}` : ""}`);
  }
  console.log(`Uploaded to ${bucket}/${KEY}. Agreements prepared or regenerated from now on carry the signature.`);
}

main().catch((error) => fail(error.message));
