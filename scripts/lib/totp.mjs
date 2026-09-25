/**
 * Time based one time passwords (RFC 6238), the 6 digit codes an
 * authenticator app shows, computed with node:crypto and nothing else.
 *
 * Why it exists: the admin area asks for a second factor
 * (src/lib/supabase/admin-user.ts), and the scripts that sign in to it as
 * the support admin (scripts/admin-totp.mjs, scripts/authz-matrix.mjs) have
 * no phone. They hold the factor's secret in .env.local
 * (ADMIN_SUPPORT_TOTP_SECRET) and compute the code the app would show.
 *
 * Supabase Auth's TOTP factors use the RFC defaults: HMAC-SHA1, a 30 second
 * step, 6 digits, the secret in base32 (RFC 4648, no padding). So do these
 * functions unless told otherwise.
 *
 *   import { totp } from "./lib/totp.mjs";
 *   const code = totp(process.env.ADMIN_SUPPORT_TOTP_SECRET);   // "492039"
 *
 * Never log a secret or a code. The tests in totp.test.mjs pin the RFC 4226
 * and RFC 6238 vectors (`npm run test:scripts`).
 */

import { createHmac } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const DEFAULT_STEP_SECONDS = 30;
export const DEFAULT_DIGITS = 6;

/**
 * The bytes a base32 secret stands for. Case, spaces, dashes and trailing
 * `=` padding are forgiven (apps show the secret in groups); any other
 * character throws, so a mistyped secret fails loudly instead of producing
 * codes that never match.
 */
export function base32Decode(secret) {
  if (typeof secret !== "string") throw new TypeError("The secret must be a string.");
  const clean = secret.replace(/[\s-]/g, "").replace(/=+$/, "").toUpperCase();
  if (clean.length === 0) throw new Error("The secret is empty.");

  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) throw new Error("The secret is not base32.");
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >>> bits) & 0xff);
    }
    buffer &= (1 << bits) - 1;
  }
  return Buffer.from(bytes);
}

/** The base32 spelling of `bytes`, upper case, no padding: the inverse of base32Decode. */
export function base32Encode(bytes) {
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32_ALPHABET[(buffer >>> bits) & 31];
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) out += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  return out;
}

/**
 * HOTP (RFC 4226): HMAC-SHA1 of the 8 byte big endian counter, dynamic
 * truncation, the last `digits` decimal digits, zero padded.
 */
export function hotp(key, counter, digits = DEFAULT_DIGITS) {
  if (!Number.isSafeInteger(counter) || counter < 0) throw new RangeError("The counter must be a whole number, 0 or more.");
  if (!Number.isInteger(digits) || digits < 6 || digits > 10) throw new RangeError("Codes have 6 to 10 digits.");

  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(message).digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/**
 * TOTP (RFC 6238) for a base32 secret: the HOTP of the number of whole
 * steps since the Unix epoch. `time` is in milliseconds, like Date.now().
 */
export function totp(secret, { time = Date.now(), step = DEFAULT_STEP_SECONDS, digits = DEFAULT_DIGITS } = {}) {
  if (!Number.isFinite(time) || time < 0) throw new RangeError("The time must be a timestamp in milliseconds.");
  if (!Number.isInteger(step) || step <= 0) throw new RangeError("The step must be a whole number of seconds.");
  const counter = Math.floor(time / 1000 / step);
  return hotp(base32Decode(secret), counter, digits);
}

/** Seconds left before the code for `time` changes, so a caller can wait for a fresh one. */
export function secondsLeft({ time = Date.now(), step = DEFAULT_STEP_SECONDS } = {}) {
  return step - (Math.floor(time / 1000) % step);
}
