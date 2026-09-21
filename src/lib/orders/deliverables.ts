import { deleteObject, headObjectSize, presignUpload } from "@/lib/r2/client";
import { acceptedTypesMessage, extensionFor, sanitizeFileName, sizeLimitMessage } from "@/lib/r2/keys";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ServiceDeliverableRow, UserServiceDeliverableRow, UserServiceRow } from "@/lib/db/types";

/**
 * Files the firm returns to the client. Contract (docs/admin-contract.md)
 * sections 6 and 8. Same two step shape as the client's uploads:
 *
 *   1. createDeliverableUpload({...}) checks the claims, writes a `pending`
 *      row and hands back a presigned PUT good for five minutes.
 *   2. confirmDeliverable(id) asks the bucket what arrived (HeadObject) and
 *      flips the row to `ready`, which is when the client's RLS policy lets
 *      them see it.
 *
 * Key shape: deliverables/{orderId}/{uuid}.{ext}. Accepted types are PDF,
 * JPG, PNG and DOCX up to 20 MB, the same message copy as the documents.
 * An unpaid order (`paid_at` null) takes no file: 409 "order_unpaid".
 *
 * A file sent by mistake is taken back with deleteDeliverable(id): the
 * object in the bucket, then the row.
 */

export const DELIVERABLE_ACCEPTED_MIME: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const DELIVERABLE_MAX_BYTES = 20 * 1024 * 1024;

export const MAX_DELIVERABLE_LABEL_LENGTH = 120;

export type DeliverableErrorCode =
  | "order_not_found"
  | "order_unpaid"
  | "template_mismatch"
  | "label_required"
  | "type_not_accepted"
  | "too_large"
  | "deliverable_not_found"
  | "no_file"
  | "upload_incomplete";

export class DeliverableError extends Error {
  readonly code: DeliverableErrorCode;
  readonly status: 404 | 409 | 413 | 415 | 422;

  constructor(code: DeliverableErrorCode, status: 404 | 409 | 413 | 415 | 422, message: string) {
    super(message);
    this.name = "DeliverableError";
    this.code = code;
    this.status = status;
  }
}

export type CreateDeliverableUploadInput = {
  userServiceId: string;
  label: string;
  serviceDeliverableId?: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  actorId: string;
};

export type CreateDeliverableUploadResult = {
  deliverableId: string;
  url: string;
  key: string;
  expiresIn: number;
};

const SAFE_SEGMENT = /^[a-z0-9][a-z0-9_-]*$/i;

type Template = Pick<ServiceDeliverableRow, "id" | "service_id" | "label">;

/** The object key for a new deliverable. Checked like buildStorageKey so nothing can leave the order's folder. */
export function buildDeliverableKey(userServiceId: string, ext: string): string {
  if (!SAFE_SEGMENT.test(userServiceId)) throw new Error("buildDeliverableKey: invalid userServiceId");
  if (!/^[a-z0-9]+$/.test(ext)) throw new Error("buildDeliverableKey: invalid extension");
  return `deliverables/${userServiceId}/${crypto.randomUUID()}.${ext}`;
}

export async function createDeliverableUpload(
  input: CreateDeliverableUploadInput,
): Promise<CreateDeliverableUploadResult> {
  const mimeType = input.mimeType.trim().toLowerCase();
  const ext = extensionFor(mimeType);
  if (!ext || !DELIVERABLE_ACCEPTED_MIME.includes(mimeType)) {
    throw new DeliverableError("type_not_accepted", 415, acceptedTypesMessage(DELIVERABLE_ACCEPTED_MIME));
  }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > DELIVERABLE_MAX_BYTES) {
    throw new DeliverableError("too_large", 413, sizeLimitMessage(DELIVERABLE_MAX_BYTES));
  }

  const admin = createAdminClient();

  const { data: orderData, error: orderError } = await admin
    .from("user_services")
    .select("id, service_id, paid_at")
    .eq("id", input.userServiceId)
    .maybeSingle();
  if (orderError) throw new Error(`createDeliverableUpload: ${orderError.message}`);
  const order = orderData as Pick<UserServiceRow, "id" | "service_id" | "paid_at"> | null;
  if (!order) throw new DeliverableError("order_not_found", 404, "Order not found.");
  if (!order.paid_at) throw new DeliverableError("order_unpaid", 409, "Payment first.");

  let template: Template | null = null;
  if (input.serviceDeliverableId) {
    const { data, error } = await admin
      .from("service_deliverables")
      .select("id, service_id, label")
      .eq("id", input.serviceDeliverableId)
      .maybeSingle();
    if (error) throw new Error(`createDeliverableUpload: ${error.message}`);
    template = data as Template | null;
    if (!template || template.service_id !== order.service_id) {
      throw new DeliverableError("template_mismatch", 422, "That deliverable does not belong to this service.");
    }
  }

  // A blank label falls back to the template's, so the usual case is one
  // click; a custom file needs its own label.
  const label = (input.label.trim() || template?.label || "").slice(0, MAX_DELIVERABLE_LABEL_LENGTH);
  if (!label) throw new DeliverableError("label_required", 422, "Give the file a label.");

  const key = buildDeliverableKey(order.id, ext);
  const { url, expiresIn } = await presignUpload({ key, contentType: mimeType, contentLength: input.sizeBytes });

  const { data: inserted, error: insertError } = await admin
    .from("user_service_deliverables")
    .insert({
      user_service_id: order.id,
      service_deliverable_id: template?.id ?? null,
      label,
      storage_key: key,
      status: "pending",
      file_name: sanitizeFileName(input.fileName),
      mime_type: mimeType,
      size_bytes: input.sizeBytes,
      uploaded_by: input.actorId,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    throw new Error(`createDeliverableUpload: ${insertError?.message ?? "no row"}`);
  }

  return { deliverableId: (inserted as { id: string }).id, url, key, expiresIn };
}

export async function confirmDeliverable(deliverableId: string): Promise<UserServiceDeliverableRow> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("user_service_deliverables")
    .select("*")
    .eq("id", deliverableId)
    .maybeSingle();
  if (error) throw new Error(`confirmDeliverable: ${error.message}`);
  const row = data as UserServiceDeliverableRow | null;
  if (!row) throw new DeliverableError("deliverable_not_found", 404, "This file is not on record.");
  if (row.status === "ready") return row;
  if (!row.storage_key || row.size_bytes === null) {
    throw new DeliverableError("no_file", 409, "This entry has no file to confirm.");
  }

  const size = await headObjectSize(row.storage_key);
  if (size === null || size !== row.size_bytes) {
    throw new DeliverableError("upload_incomplete", 422, "Upload incomplete.");
  }

  const { data: updatedRows, error: updateError } = await admin
    .from("user_service_deliverables")
    .update({ status: "ready" })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("*");
  if (updateError) throw new Error(`confirmDeliverable: ${updateError.message}`);
  const updated = (updatedRows ?? [])[0] as UserServiceDeliverableRow | undefined;

  // No row means a parallel confirm won; the file is ready either way.
  return updated ?? { ...row, status: "ready" };
}

/**
 * Removes a returned file (DELETE /api/admin/deliverables/[id]), whatever
 * its status: a `pending` row whose upload never finished goes the same way.
 * Answers the row as it was, for the audit line.
 *
 * The object goes first, then the row. A failure in between leaves the row,
 * so the file still shows in the modal and Remove can be pressed again
 * (deleting a key that is already gone is not an error in R2). The other
 * order would risk a file in the bucket with no row pointing at it, which
 * nobody could find or remove. Two removals at once both succeed: the
 * second deletes nothing.
 *
 * The key must sit in the order's own deliverables folder, as
 * buildDeliverableKey writes it; anything else is refused before the bucket
 * is touched, so a damaged row can never take a client's document with it.
 */
export async function deleteDeliverable(deliverableId: string): Promise<UserServiceDeliverableRow> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("user_service_deliverables")
    .select("*")
    .eq("id", deliverableId)
    .maybeSingle();
  if (error) throw new Error(`deleteDeliverable: ${error.message}`);
  const row = data as UserServiceDeliverableRow | null;
  if (!row) throw new DeliverableError("deliverable_not_found", 404, "This file is not on record.");

  if (row.storage_key) {
    if (!row.storage_key.startsWith(`deliverables/${row.user_service_id}/`)) {
      throw new Error(`deleteDeliverable: ${row.id} holds a key outside its order's folder`);
    }
    await deleteObject(row.storage_key);
  }

  const { error: deleteError } = await admin.from("user_service_deliverables").delete().eq("id", row.id);
  if (deleteError) throw new Error(`deleteDeliverable: ${deleteError.message}`);

  return row;
}
