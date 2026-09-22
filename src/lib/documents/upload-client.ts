/**
 * How the browser sends a file, for the client's document slots and for the
 * admin's deliverables alike. No React, no server imports: the two components
 * differ in their routes and their copy, never in the mechanics.
 *
 * Three things it fixes, all from the failed upload of 2026-09-22:
 *
 *   1. The file is read into memory first (`readFileBytes`). A file the
 *      browser cannot read, because it was moved, renamed or synced away
 *      since the picker listed it, fails here, before any row exists, with a
 *      line that says what to do. Reading first also means the PUT sends
 *      bytes that are already in hand, so a read cannot fail halfway through
 *      a request.
 *   2. What goes to the bucket is a Blob of those bytes with the type the
 *      URL was signed for, not the File object.
 *   3. When the direct PUT fails for any reason, the same bytes are posted to
 *      our own origin, which writes them to the bucket and finishes the
 *      upload. The caller hears about it through `onFallback` so the slot can
 *      say what is happening.
 *
 * The caller confirms the upload itself when the bucket took the file
 * (`via: "bucket"`); the fallback route has already confirmed it, and answers
 * the finished row as `body`.
 */

import { DIRECT_TOO_BIG, FILE_UNREADABLE, UPLOAD_FAILED, directUploadLimit } from "./direct-upload";

export { FILE_UNREADABLE, UPLOAD_FAILED };

export type SendResult = { via: "bucket" } | { via: "server"; body: unknown };

/**
 * The file's bytes. Throws with FILE_UNREADABLE when the browser cannot read
 * it, which is a line the person can act on, unlike the browser's own error.
 */
export async function readFileBytes(file: File): Promise<ArrayBuffer> {
  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    throw new Error(FILE_UNREADABLE);
  }
  if (bytes.byteLength === 0) throw new Error(FILE_UNREADABLE);
  return bytes;
}

/**
 * Sends the bytes to the bucket, and through our own server when that fails.
 * Throws with the line to show: the server's own refusal when it answered
 * one, otherwise UPLOAD_FAILED, which is kept for the case where the fallback
 * failed too.
 */
export async function sendBytes(input: {
  /** The presigned PUT the bucket signed for this file. */
  url: string;
  /** The route on our origin that takes the same bytes, already carrying its id. */
  fallbackUrl: string;
  bytes: ArrayBuffer;
  mimeType: string;
  /** The slot's own limit; the fallback carries less than a request can hold. */
  maxBytes: number;
  onProgress: (percent: number) => void;
  onFallback: () => void;
}): Promise<SendResult> {
  const body = new Blob([input.bytes], { type: input.mimeType });

  try {
    await xhrSend("PUT", input.url, body, input.mimeType, input.onProgress);
    return { via: "bucket" };
  } catch {
    // The bucket did not take it. Fall through to our own server.
  }

  if (input.bytes.byteLength > directUploadLimit(input.maxBytes)) throw new Error(DIRECT_TOO_BIG);

  input.onFallback();
  const answer = await xhrSend("POST", input.fallbackUrl, body, input.mimeType, input.onProgress);
  return { via: "server", body: answer };
}

/**
 * One request with progress. XMLHttpRequest rather than fetch because only
 * XHR reports upload progress. A refusal with a JSON `{ error }` becomes an
 * Error carrying that one line; anything else becomes UPLOAD_FAILED.
 */
function xhrSend(
  method: "PUT" | "POST",
  url: string,
  body: Blob,
  mimeType: string,
  onProgress: (percent: number) => void,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(parseBody(xhr.responseText));
      else reject(new Error(errorLine(xhr.responseText) ?? UPLOAD_FAILED));
    };
    xhr.onerror = () => reject(new Error(UPLOAD_FAILED));
    xhr.onabort = () => reject(new Error(UPLOAD_FAILED));
    xhr.ontimeout = () => reject(new Error(UPLOAD_FAILED));
    xhr.send(body);
  });
}

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** The `{ error }` line of a refusal, when there is one. The bucket answers XML, which has none. */
function errorLine(text: string): string | null {
  const data = parseBody(text);
  if (data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string") {
    const line = (data as { error: string }).error.trim();
    return line || null;
  }
  return null;
}
