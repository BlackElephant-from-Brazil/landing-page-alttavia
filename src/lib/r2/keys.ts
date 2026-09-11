/**
 * Where a client's file lives in the bucket, and what may go there.
 *
 * Pure module on purpose: the upload route, the slot component in the browser
 * and the tests all import it, so nothing here touches the network, the
 * environment or `server-only`. The S3 client lives in ./client.ts.
 *
 * Key shape (contract section 10):
 *
 *   orders/{userServiceId}/{docKey}/{applicantIndex}/{uuid}.{ext}
 *
 * The uuid means a replacement never overwrites the file it replaces, so a
 * rejected upload stays readable for as long as its row exists.
 */

/** Extension per accepted mime type. Anything else is refused before a key exists. */
const EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

/** Short names for the messages a visitor reads. */
const LABEL_BY_MIME: Readonly<Record<string, string>> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
};

/** Mime type from a file name, for browsers that report an empty `File.type` (Windows and .docx, mostly). */
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Longest file name stored in `user_documents.file_name`. */
export const MAX_FILE_NAME_LENGTH = 120;

/** The extension a mime type is stored under, or null when the type is not one we accept at all. */
export function extensionFor(mime: string): string | null {
  return EXTENSION_BY_MIME[mime.trim().toLowerCase()] ?? null;
}

/** The mime type a file name suggests, or null when the extension is unknown. */
export function mimeForFileName(fileName: string): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  if (!match) return null;
  return MIME_BY_EXTENSION[match[1].toLowerCase()] ?? null;
}

/** The short label a visitor reads for a mime type ("PDF"), falling back to the type itself. */
export function labelForMime(mime: string): string {
  return LABEL_BY_MIME[mime.trim().toLowerCase()] ?? mime;
}

const SAFE_SEGMENT = /^[a-z0-9][a-z0-9_-]*$/i;

/**
 * The object key for a new upload. `docKey` comes from `service_docs.key`
 * and `ext` from extensionFor(); both are checked again here because a slash
 * or a dot in either would move the object out of its order's folder.
 */
export function buildStorageKey(
  userServiceId: string,
  docKey: string,
  applicantIndex: 0 | 1,
  ext: string,
): string {
  if (!SAFE_SEGMENT.test(userServiceId)) throw new Error("buildStorageKey: invalid userServiceId");
  if (!SAFE_SEGMENT.test(docKey)) throw new Error("buildStorageKey: invalid docKey");
  if (applicantIndex !== 0 && applicantIndex !== 1) throw new Error("buildStorageKey: invalid applicantIndex");
  if (!/^[a-z0-9]+$/.test(ext)) throw new Error("buildStorageKey: invalid extension");
  return `orders/${userServiceId}/${docKey}/${applicantIndex}/${crypto.randomUUID()}.${ext}`;
}

/**
 * The name stored next to the file: control characters and path separators
 * removed, whitespace collapsed, cut to MAX_FILE_NAME_LENGTH while keeping the
 * extension. Never used as part of the object key, only shown back to the
 * client and sent as the download's file name.
 */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[\u0000-\u001f\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "file";
  if (cleaned.length <= MAX_FILE_NAME_LENGTH) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 && cleaned.length - dot <= 8 ? cleaned.slice(dot) : "";
  const base = ext ? cleaned.slice(0, dot) : cleaned;
  return base.slice(0, MAX_FILE_NAME_LENGTH - ext.length).trimEnd() + ext;
}

/** "10 MB", "500 KB". Whole numbers, no decimals, for the messages below. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

/**
 * The two one line messages the route answers with and the slot shows before
 * it ever calls the route, so a visitor reads the same words either way.
 */
export function acceptedTypesMessage(acceptedMime: readonly string[]): string {
  const labels = Array.from(new Set(acceptedMime.map(labelForMime)));
  return `This file type is not accepted. Use ${listWords(labels)}.`;
}

export function sizeLimitMessage(maxBytes: number): string {
  return `This file is too large. The limit is ${formatBytes(maxBytes)}.`;
}

/** "PDF, JPG or PNG". */
function listWords(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
}
