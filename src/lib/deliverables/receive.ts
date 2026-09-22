import type { UserServiceDeliverableRow } from "@/lib/db/types";
import { checkDirectUpload, type DirectUploadCheck } from "@/lib/documents/direct-upload";
import { DELIVERABLE_MAX_BYTES, DeliverableError, confirmDeliverable } from "@/lib/orders/deliverables";
import { putObject } from "@/lib/r2/client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The same origin fallback for a file the firm returns to a client, the twin
 * of src/lib/documents/confirm.ts on the client's side. Used by
 * POST /api/admin/deliverables/upload when the admin's direct PUT to the
 * bucket never arrived, which is what happened on 2026-09-22 with a 526 KB
 * image.
 *
 * The bytes are written from here and the row is then finished by
 * `confirmDeliverable`, the same function the ordinary confirm route calls,
 * so a file that came this way is in every respect a file that came the
 * usual way.
 *
 * Nothing about the row is taken from the request: the type, the size and the
 * key all come from the `pending` row the upload URL created.
 */

export type ReceiveDeliverableInput = {
  deliverableId: string;
  /** The `Content-Type` of the request, checked against the row. */
  contentType: string | null;
  /** The `Content-Length` of the request, checked against the row before the body is read. */
  contentLength: number | null;
  /** The body, once read. Absent on the first call, which only checks the headers. */
  bytes?: Uint8Array;
};

export type ReceiveDeliverableHeaders = {
  row: UserServiceDeliverableRow;
  /** Set when the row is already `ready`: nothing to write, answer the row. */
  done: boolean;
};

/**
 * Loads the row and checks everything that can be checked before the body is
 * read. Throws a DeliverableError the route can answer as it is.
 */
export async function openDeliverableUpload(
  input: Pick<ReceiveDeliverableInput, "deliverableId" | "contentType" | "contentLength">,
): Promise<ReceiveDeliverableHeaders> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_service_deliverables")
    .select("*")
    .eq("id", input.deliverableId)
    .maybeSingle();
  if (error) throw new Error(`openDeliverableUpload: ${error.message}`);
  const row = data as UserServiceDeliverableRow | null;
  if (!row) throw new DeliverableError("deliverable_not_found", 404, "This file is not on record.");

  // Already finished: the admin retried after a request that did arrive.
  if (row.status === "ready") return { row, done: true };
  if (row.status !== "pending") throw new DeliverableError("no_file", 409, "This entry has no file to confirm.");
  if (!row.storage_key || row.size_bytes === null || !row.mime_type) {
    throw new DeliverableError("no_file", 409, "This entry has no file to confirm.");
  }
  if (!row.storage_key.startsWith(`deliverables/${row.user_service_id}/`)) {
    throw new Error(`openDeliverableUpload: ${row.id} holds a key outside its order's folder`);
  }

  raise(
    checkDirectUpload({
      expectedBytes: row.size_bytes,
      expectedType: row.mime_type,
      maxBytes: DELIVERABLE_MAX_BYTES,
      contentType: input.contentType,
      contentLength: input.contentLength,
    }),
  );

  return { row, done: false };
}

/**
 * Writes the body to the bucket and finishes the row. The caller has already
 * been through `openDeliverableUpload`, so the row is `pending` and its key
 * and type are known good.
 */
export async function receiveDeliverableBytes(
  row: UserServiceDeliverableRow,
  bytes: Uint8Array,
): Promise<UserServiceDeliverableRow> {
  raise(
    checkDirectUpload({
      expectedBytes: row.size_bytes ?? 0,
      expectedType: row.mime_type ?? "",
      maxBytes: DELIVERABLE_MAX_BYTES,
      receivedBytes: bytes.byteLength,
    }),
  );

  await putObject({ key: row.storage_key as string, body: bytes, contentType: row.mime_type as string });

  return await confirmDeliverable(row.id);
}

/** Turns a refusal from the shared rules into the error the admin routes answer with. */
function raise(check: DirectUploadCheck): void {
  if (check.ok) return;
  const code = check.status === 413 ? "too_large" : check.status === 415 ? "type_not_accepted" : "upload_incomplete";
  throw new DeliverableError(code, check.status, check.error);
}
