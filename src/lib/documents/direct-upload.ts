/**
 * The rules behind the same origin fallback: what a file may weigh when it
 * comes through our own server instead of going straight to the bucket, and
 * what has to match the row that is waiting for it.
 *
 * Why the fallback exists. On 2026-09-22 a client picked a proof of address,
 * the browser asked for an upload URL, and the PUT to the bucket never
 * arrived: HeadObject found nothing, the slot said the upload did not finish,
 * and the retry was refused because the slot still held the pending row. A
 * passport from the same browser had worked seconds earlier, so the cause was
 * that one request, not the size, the type or CORS. When the direct PUT fails
 * the browser now posts the bytes it already read to our own origin, which
 * writes them to the bucket for it.
 *
 * Why a cap of 4.5 MB. A Netlify function takes about 6 MB of request
 * payload, so anything near that fails at the edge with no message worth
 * reading. Above the cap the fallback refuses in one line the person can act
 * on; the direct PUT has no such limit, so a large file still uploads the
 * normal way.
 *
 * Pure on purpose: the browser imports it for the same limit and the same
 * words the routes answer with, so a refusal reads the same on both sides.
 */

/** The most a request through our own server may carry. */
export const DIRECT_UPLOAD_MAX_BYTES = 4_500_000;

export const FILE_UNREADABLE = "We could not read this file. Save a new copy or take a new photo, then try again.";
export const DIRECT_TOO_BIG = "This file is too big to send this way. Compress it to under 4 MB and try again.";
export const DIRECT_INCOMPLETE = "This file did not arrive whole. Try again.";
export const DIRECT_TYPE_MISMATCH = "This file type does not match the one we expected.";
export const UPLOAD_FAILED = "The upload did not finish. Try again.";

/** The limit for one slot: its own maximum, never more than a request can carry. */
export function directUploadLimit(maxBytes: number): number {
  return Math.min(maxBytes, DIRECT_UPLOAD_MAX_BYTES);
}

export type DirectUploadCheck = { ok: true } | { ok: false; status: 413 | 415 | 422; error: string };

const OK: DirectUploadCheck = { ok: true };

/** "image/png; charset=binary" is "image/png". Null and blank stay null. */
export function normalizeContentType(value: string | null | undefined): string | null {
  const first = (value ?? "").split(";")[0].trim().toLowerCase();
  return first || null;
}

/**
 * Everything the fallback checks about a body before it writes anything:
 * the row's own size against the cap, then the request's declared type and
 * length, then the bytes that actually arrived. `contentLength` and
 * `receivedBytes` are each checked only when given, so the same function
 * serves the check before the body is read and the check after it.
 */
export function checkDirectUpload(input: {
  /** `size_bytes` on the pending row: what the bucket was promised. */
  expectedBytes: number;
  /** `mime_type` on the pending row. */
  expectedType: string;
  /** The slot's own limit, from `service_docs.max_bytes` or the deliverable maximum. */
  maxBytes: number;
  contentType?: string | null;
  contentLength?: number | null;
  receivedBytes?: number | null;
}): DirectUploadCheck {
  const limit = directUploadLimit(input.maxBytes);
  if (!Number.isInteger(input.expectedBytes) || input.expectedBytes <= 0) {
    return { ok: false, status: 422, error: DIRECT_INCOMPLETE };
  }
  if (input.expectedBytes > limit) return { ok: false, status: 413, error: DIRECT_TOO_BIG };

  const type = normalizeContentType(input.contentType);
  if (type !== null && type !== input.expectedType.trim().toLowerCase()) {
    return { ok: false, status: 415, error: DIRECT_TYPE_MISMATCH };
  }

  const declared = input.contentLength;
  if (typeof declared === "number") {
    if (declared > limit) return { ok: false, status: 413, error: DIRECT_TOO_BIG };
    if (declared !== input.expectedBytes) return { ok: false, status: 422, error: DIRECT_INCOMPLETE };
  }

  const received = input.receivedBytes;
  if (typeof received === "number" && received !== input.expectedBytes) {
    return { ok: false, status: 422, error: DIRECT_INCOMPLETE };
  }

  return OK;
}

export type LengthCheck = { ok: true; length: number } | { ok: false; status: 411; error: string };

/**
 * Whether a request says how long its body is, before a single byte is read.
 *
 * `checkDirectUpload` only compares a length it was given, because the same
 * function serves the check before the body and the check after it. A request
 * that declares no length would therefore walk past it, and the size would be
 * found out only after `arrayBuffer()` had already pulled the whole body into
 * memory. A signed in client could send a body of any length that way.
 *
 * So the fallback routes ask for the length first and refuse 411 without one.
 * Nothing legitimate loses by this: the browser sends a Blob through
 * XMLHttpRequest (src/lib/documents/upload-client.ts), which always carries
 * `Content-Length`. A body declared as zero bytes is refused here too, since
 * no row is ever waiting for an empty file.
 */
export function requireDeclaredLength(contentLength: number | null): LengthCheck {
  if (contentLength === null || contentLength <= 0) {
    return { ok: false, status: 411, error: DIRECT_INCOMPLETE };
  }
  return { ok: true, length: contentLength };
}

/** The `Content-Length` header as a number, or null when it is missing or not a number. */
export function contentLengthOf(request: { headers: { get(name: string): string | null } }): number | null {
  const raw = request.headers.get("content-length");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}
