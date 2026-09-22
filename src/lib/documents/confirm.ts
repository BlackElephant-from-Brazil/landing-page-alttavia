import { getUserService, type Db } from "@/lib/db/queries";
import type { ServiceDocRow, UserDocumentRow, UserServiceRow } from "@/lib/db/types";
import { notifyDocumentsReady } from "@/lib/orders/notify";
import { deleteObject, headObjectSize } from "@/lib/r2/client";

import { DOCUMENTS_STAGE } from "./stage";

/**
 * Step two of a client's upload, in one place.
 *
 * Two routes finish an upload and both end here: POST /api/documents/confirm,
 * after the browser PUT the file straight to the bucket, and
 * POST /api/documents/upload, the same origin fallback that writes the bytes
 * itself when that PUT never arrives. They must agree on everything that
 * follows, so nothing here is copied into either of them.
 *
 * What finishing an upload means:
 *
 *   1. Ask the bucket what arrived (HeadObject) and compare it with the size
 *      the row was created with. The server never takes the browser's word.
 *   2. Drop the file this one replaces. A client may send a new file for a
 *      slot that is still waiting for review while the order sits on the
 *      documents stage; the older `uploaded` row of that slot goes here, once
 *      the bucket has confirmed the new object is in place, so a failed
 *      replacement never leaves the slot empty.
 *   3. Move the row from `pending` to `uploaded`, once, with a conditional
 *      update, so two calls at the same time cannot both report success.
 *   4. Tell the team, when this upload filled the last required slot and the
 *      set was not already complete.
 *
 * Why 2 comes before 3 (2026-09-22). `user_documents_live_slot_idx`
 * (0004_hardening.sql) is a unique index over (order, document, applicant)
 * for the rows that are `uploaded` or `approved`. Flipping the new row while
 * the row it replaces was still `uploaded` raised 23505, so every replacement
 * of a file that was merely waiting for review answered 500 and, through the
 * fallback route, left its bytes in the bucket with a stale `pending` row.
 * The drop is therefore a step the flip depends on, not an afterthought: the
 * object goes best effort, the row does not.
 *
 * Step 4 is best effort: a failure there is logged and the upload stands,
 * because the file is already in the bucket and on record. It fires on the
 * move from an incomplete set to a complete one only (changed 2026-09-22):
 * replacing a file that was rejected completes the set again and sends, while
 * swapping a file that was merely waiting for review sends nothing, since the
 * slot was filled before and the set was therefore already complete. Without
 * that rule a client could repeat upload, remove, upload and post the firm an
 * email each time.
 *
 * DOCUMENTS_STAGE, the one stage on which a client may still change a file,
 * is re-exported from ./stage so the routes take it from here and the browser
 * takes it from there.
 */

export { DOCUMENTS_STAGE };

export const APPROVED_LOCKED = "This file was approved and cannot be changed.";
export const REVIEW_LOCKED = "This file can no longer be changed.";
export const STAGE_CLOSED = "This order has moved on. Write to us if you still need to send a file.";
export const SLOT_FILLED = "Another file reached this slot first. Refresh the page.";
export const NOT_ON_RECORD = "This file is not on record.";
export const NOT_YOURS = "This order is not yours.";
export const ALREADY_REVIEWED = "This file has already been reviewed.";
export const UPLOAD_INCOMPLETE = "Upload incomplete.";

export type DocumentErrorCode =
  | "not_found"
  | "not_yours"
  | "unpaid"
  | "already_reviewed"
  | "upload_incomplete"
  | "locked";

/** A refusal with a status and one line the slot shows as it is. */
export class DocumentError extends Error {
  readonly code: DocumentErrorCode;
  readonly status: 403 | 404 | 409 | 422;

  constructor(code: DocumentErrorCode, status: 403 | 404 | 409 | 422, message: string) {
    super(message);
    this.name = "DocumentError";
    this.code = code;
    this.status = status;
  }
}

export type OwnDocument = { document: UserDocumentRow; order: UserServiceRow };

/**
 * One of the caller's own upload rows, with the order it belongs to. A row
 * that does not exist and a row that belongs to someone else are told apart
 * on purpose: the second is already a 403 everywhere else in the dashboard,
 * and the id came from a page only its owner can load.
 */
export async function loadOwnDocument(db: Db, documentId: string, userId: string): Promise<OwnDocument> {
  const { data, error } = await db.from("user_documents").select("*").eq("id", documentId).maybeSingle();
  if (error) throw new Error(`user_documents: ${error.message}`);
  const document = data as UserDocumentRow | null;
  if (!document) throw new DocumentError("not_found", 404, NOT_ON_RECORD);

  const order = await getUserService(db, document.user_service_id, userId);
  if (!order) throw new DocumentError("not_yours", 403, NOT_YOURS);

  return { document, order };
}

/** The slot a row belongs to, for its type and size limits. */
export async function loadServiceDoc(db: Db, serviceDocId: string): Promise<ServiceDocRow | null> {
  const { data, error } = await db.from("service_docs").select("*").eq("id", serviceDocId).maybeSingle();
  if (error) throw new Error(`service_docs: ${error.message}`);
  return (data as ServiceDocRow | null) ?? null;
}

/**
 * Finishes the upload behind `document`. Answers the row as it now stands;
 * a row that is already `uploaded` is answered as it is, so a retried request
 * never fails and sends nothing a second time.
 */
export async function confirmDocumentUpload(input: {
  db: Db;
  document: UserDocumentRow;
  order: UserServiceRow;
  /** Where the links in the team email point. */
  origin: string | null;
}): Promise<UserDocumentRow> {
  const { db, document, order, origin } = input;

  if (document.status === "uploaded") return document;
  if (document.status !== "pending") throw new DocumentError("already_reviewed", 409, ALREADY_REVIEWED);

  const size = await headObjectSize(document.storage_key);
  if (size === null || size !== document.size_bytes) {
    throw new DocumentError("upload_incomplete", 422, UPLOAD_INCOMPLETE);
  }

  // The new object is in the bucket. The slot may now be cleared of the file
  // this one replaces, which has to happen before the flip: two live rows on
  // one slot are what the unique index forbids.
  const replacedLiveFile = await dropSupersededFiles(db, document);

  const { data: updated, error: updateError } = await db
    .from("user_documents")
    .update({ status: "uploaded", uploaded_at: new Date().toISOString() })
    .eq("id", document.id)
    .eq("status", "pending")
    .select("*")
    .single();
  if (updateError || !updated) {
    // 23505 is the live slot index: another upload on this slot was confirmed
    // while this one was in flight. That is a refusal the slot can show, not
    // a failure: the bytes are in the bucket, the row stays `pending` and the
    // client sees what did land once the page is refreshed.
    if (isLiveSlotConflict(updateError)) throw new DocumentError("locked", 409, SLOT_FILLED);
    throw new Error(`user_documents update: ${updateError?.message ?? "no row"}`);
  }
  const confirmed = updated as UserDocumentRow;

  // The upload is recorded. When it filled the last required slot, and the
  // set was not already complete, the team hears about it. Best effort:
  // notifyDocumentsReady never throws.
  if (!replacedLiveFile) await notifyDocumentsReady({ order, document: confirmed }, { db, origin });

  return confirmed;
}

/** The unique index over the live rows of a slot refused the write. */
function isLiveSlotConflict(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || /duplicate key value/i.test(error.message ?? "");
}

/**
 * Clears the slot for the file that is about to be confirmed: every other row
 * of the same slot that still waits for a review goes, row first, then
 * object. Rejected rows stay, because they are the history of the review.
 * Answers whether a file that was waiting for review was actually replaced,
 * which is what decides the team email.
 *
 * An approved row is a refusal, not a removal: the slot is closed once the
 * firm has accepted a file, which is what POST /api/documents/upload-url
 * answers before a new row is ever written. A `pending` row that slipped
 * through between the two calls would be approved in the meantime, and the
 * client is told so rather than having the approved file taken from under
 * the firm.
 *
 * Why the row goes first, and only while it is still `uploaded` (2026-09-22).
 * The firm can approve the very row this read saw as waiting, in the moment
 * between the read and the delete. A plain `delete().eq("id", …)` would then
 * destroy an approved file, object and row, with nothing left to show it
 * existed. The delete therefore carries the status, like every other write
 * here, and answers which rows it took: none means the firm got there first
 * and the client is told so. The object is removed only after a row has
 * really gone, so a file is never taken from a row that still points at it.
 *
 * Throws when the row cannot be removed. A leftover live row would make the
 * flip that follows fail on the unique index with a message nobody can read,
 * and the caller answering 500 without writing is the honest outcome: the new
 * object is in the bucket, the row is still `pending`, and a retry finishes
 * the upload. A failed object removal is only logged, since an object nothing
 * points at harms nobody.
 */
async function dropSupersededFiles(db: Db, incoming: UserDocumentRow): Promise<boolean> {
  const { data, error } = await db
    .from("user_documents")
    .select("*")
    .eq("user_service_id", incoming.user_service_id)
    .eq("service_doc_id", incoming.service_doc_id)
    .eq("applicant_index", incoming.applicant_index);
  if (error) throw new Error(`user_documents: ${error.message}`);

  const siblings = ((data ?? []) as UserDocumentRow[]).filter((row) => row.id !== incoming.id);
  if (siblings.some((row) => row.status === "approved")) {
    throw new DocumentError("locked", 409, APPROVED_LOCKED);
  }

  let replaced = false;
  for (const row of siblings.filter((row) => row.status === "uploaded")) {
    const { data: gone, error: deleteError } = await db
      .from("user_documents")
      .delete()
      .eq("id", row.id)
      .eq("status", "uploaded")
      .select("id");
    if (deleteError) throw new Error(`user_documents delete: ${deleteError.message}`);
    if (((gone ?? []) as unknown[]).length === 0) {
      // The row is no longer waiting for review: the firm reviewed it while
      // this upload was being checked. Only an approval can have made it
      // live again, so the slot is closed and nothing has been touched.
      throw new DocumentError("locked", 409, APPROVED_LOCKED);
    }
    replaced = true;
    try {
      if (isOrderFile(row)) await deleteObject(row.storage_key);
    } catch (err) {
      console.error(`dropSupersededFiles: ${row.id} left its object behind:`, err);
    }
  }
  return replaced;
}

/** True when the row's key sits in its own order's folder, as buildStorageKey writes it. */
export function isOrderFile(row: Pick<UserDocumentRow, "storage_key" | "user_service_id">): boolean {
  return row.storage_key.startsWith(`orders/${row.user_service_id}/`);
}

/**
 * Removes one of the client's own files: the row, then the object. Used by
 * DELETE /api/documents/[id], where the caller has already checked that the
 * order is theirs and that the file may still be changed.
 *
 * A key outside the order's folder is refused before the bucket is touched,
 * so a damaged row can never take another order's file with it.
 *
 * The row goes first and carries the status the route read (2026-09-22). The
 * firm can approve the file between the route's read and this call, and the
 * old order, object first with no condition, destroyed the approved file. Now
 * nothing matches, the bucket is never touched and the client is told what
 * happened. It also means a failed delete can no longer leave a row pointing
 * at an object that is gone, which showed as a View link that opened nothing.
 */
export async function deleteOwnDocument(db: Db, document: UserDocumentRow): Promise<void> {
  if (!isOrderFile(document)) {
    throw new Error(`deleteOwnDocument: ${document.id} holds a key outside its order's folder`);
  }

  const { data: gone, error } = await db
    .from("user_documents")
    .delete()
    .eq("id", document.id)
    .eq("status", document.status)
    .select("id");
  if (error) throw new Error(`user_documents delete: ${error.message}`);
  if (((gone ?? []) as unknown[]).length === 0) {
    throw new DocumentError("locked", 409, await lockedLineFor(db, document.id));
  }

  await deleteObject(document.storage_key);
}

/** Why the file can no longer be taken back, read from the row as it now stands. */
async function lockedLineFor(db: Db, documentId: string): Promise<string> {
  const { data, error } = await db.from("user_documents").select("status").eq("id", documentId).maybeSingle();
  if (error) console.error(`lockedLineFor: ${documentId} not read back: ${error.message}`);
  const status = (data as Pick<UserDocumentRow, "status"> | null)?.status;
  return status === "approved" ? APPROVED_LOCKED : REVIEW_LOCKED;
}
