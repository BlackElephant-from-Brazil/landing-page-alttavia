import { extensionFor } from "@/lib/r2/keys";

/**
 * What a client's file really is, read from its first bytes, for the one
 * place the server hands a client's file on to someone else: the signed
 * service agreement the team inbox receives as an attachment
 * (notifySignedAgreement in src/lib/orders/notify.ts, 2026-09-25).
 *
 *   matchesDeclaredType(bytes, mime) -> the bytes open the way the type says
 *   signedCopyFileName(orderId, mime) -> signed-agreement-<order>.<ext>, or null
 *
 * Why. The upload checks the type the browser declared and the size, never
 * the content, and the name stored with the file is the client's own
 * (sanitizeFileName keeps any extension). Attached under that name, an email
 * from the firm's own sending domain could carry "agreement.pdf.lnk" or an
 * HTML page into Patrícia's inbox, and the mail provider sets the part's
 * type from the extension. So the attachment is named here, from the type
 * the slot accepted, and it rides along only when its first bytes are what
 * that type starts with. Anything else is left in the bucket, where the
 * admin opens it through the order.
 *
 * Only the types a signed copy can arrive as are known: the slot takes PDF,
 * JPG and PNG (0013_signed_agreement_slot.sql), and WebP is here in case the
 * services editor adds it. A Word file is never attached. Pure.
 */

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

function startsWith(bytes: Uint8Array, magic: readonly number[], at = 0): boolean {
  return bytes.byteLength >= at + magic.length && magic.every((byte, index) => bytes[at + index] === byte);
}

const CHECKS: Readonly<Record<string, (bytes: Uint8Array) => boolean>> = {
  "application/pdf": (bytes) => startsWith(bytes, PDF),
  "image/jpeg": (bytes) => startsWith(bytes, JPEG),
  "image/png": (bytes) => startsWith(bytes, PNG),
  "image/webp": (bytes) => startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8),
};

const ORDER_ID = /^[a-z0-9][a-z0-9-]*$/i;

/** True when `bytes` begin the way a file of `mime` begins. An unknown type is never a match. */
export function matchesDeclaredType(bytes: Uint8Array, mime: string): boolean {
  const check = CHECKS[mime.trim().toLowerCase()];
  return check ? check(bytes) : false;
}

/**
 * The name the signed copy is attached under: `signed-agreement-<order id>`
 * and the extension of its type. Null for a type that is never attached, or
 * an order id that is not a plain id.
 */
export function signedCopyFileName(orderId: string, mime: string): string | null {
  const type = mime.trim().toLowerCase();
  if (!CHECKS[type] || !ORDER_ID.test(orderId)) return null;
  const ext = extensionFor(type);
  return ext ? `signed-agreement-${orderId}.${ext}` : null;
}
