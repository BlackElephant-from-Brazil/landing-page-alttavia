/**
 * The two links the firm gets on a client's file: open it in a tab, or save
 * it (docs/admin-contract.md section 7, 2026-09-22). Both point at
 * `GET /api/admin/documents/[id]`, which serves the file inline by default
 * and as a download with `?download=1`.
 *
 * Pure module: the order modal is a server component and the rule is worth a
 * test of its own.
 */

/** What a browser shows in a tab. A Word file is saved, never rendered, so it gets no View link. */
const INLINE_TYPES = ["application/pdf"];

export function canShowInline(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  const type = mimeType.split(";")[0].trim().toLowerCase();
  return INLINE_TYPES.includes(type) || type.startsWith("image/");
}

export function adminDocumentHref(documentId: string, mode: "view" | "download"): string {
  return `/api/admin/documents/${documentId}${mode === "download" ? "?download=1" : ""}`;
}
