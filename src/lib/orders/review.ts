import { sendEmail } from "@/lib/email/send";
import { dashboardUrl, documentRejected } from "@/lib/email/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ServiceDocRow, UserDocumentRow, UserRow, UserServiceRow } from "@/lib/db/types";

/**
 * Approves or rejects one uploaded document. Contract
 * (docs/admin-contract.md) sections 6 and 8.
 *
 *   reviewDocument(documentId, "approve", null, adminId, origin)
 *   reviewDocument(documentId, "reject", "The scan is cut off.", adminId, origin)
 *
 * Only a document with status `uploaded` can be reviewed; anything else is
 * a 409. The update carries that status, so two admins reviewing the same
 * file at once cannot both win. Approving clears any rejection reason left
 * from an earlier attempt on the slot; rejecting requires one.
 *
 * Every review writes a `user_service_events` row that stays on the order's
 * current stage (from and to are the same), so the modal's log shows it in
 * order with the stage changes. A rejection also emails the order's owner
 * through the best effort sender: a failed email is logged, never thrown.
 */

export type ReviewDecision = "approve" | "reject";

export const MAX_REASON_LENGTH = 1000;

export type ReviewErrorCode = "document_not_found" | "not_reviewable" | "reason_required" | "stale";

export class ReviewError extends Error {
  readonly code: ReviewErrorCode;
  readonly status: 404 | 409 | 422;

  constructor(code: ReviewErrorCode, status: 404 | 409 | 422, message: string) {
    super(message);
    this.name = "ReviewError";
    this.code = code;
    this.status = status;
  }
}

export type ReviewResult = {
  document: UserDocumentRow;
  /** True when the rejection email was accepted by the sender. */
  emailed: boolean;
};

type OrderState = Pick<UserServiceRow, "id" | "user_id" | "stage_key">;

export async function reviewDocument(
  documentId: string,
  decision: ReviewDecision,
  reason: string | null,
  actorId: string,
  origin?: string | null,
): Promise<ReviewResult> {
  const trimmedReason = (reason ?? "").trim();
  if (decision === "reject" && !trimmedReason) {
    throw new ReviewError("reason_required", 422, "Give the client a reason.");
  }

  const admin = createAdminClient();

  const { data: docData, error: docError } = await admin
    .from("user_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  if (docError) throw new Error(`reviewDocument: ${docError.message}`);
  const doc = docData as UserDocumentRow | null;
  if (!doc) throw new ReviewError("document_not_found", 404, "This file is not on record.");
  if (doc.status !== "uploaded") {
    throw new ReviewError("not_reviewable", 409, "This file is not waiting for review.");
  }

  const reviewedAt = new Date().toISOString();
  const patch =
    decision === "approve"
      ? { status: "approved", rejection_reason: null, reviewed_at: reviewedAt, reviewed_by: actorId }
      : { status: "rejected", rejection_reason: trimmedReason, reviewed_at: reviewedAt, reviewed_by: actorId };

  const { data: updatedRows, error: updateError } = await admin
    .from("user_documents")
    .update(patch)
    .eq("id", doc.id)
    .eq("status", "uploaded")
    .select("*");
  if (updateError) throw new Error(`reviewDocument: ${updateError.message}`);
  const updated = (updatedRows ?? [])[0] as UserDocumentRow | undefined;
  if (!updated) {
    throw new ReviewError("stale", 409, "This file was reviewed a moment ago. Refresh and try again.");
  }

  const [orderResult, slotResult] = await Promise.all([
    admin.from("user_services").select("id, user_id, stage_key").eq("id", doc.user_service_id).maybeSingle(),
    admin.from("service_docs").select("label").eq("id", doc.service_doc_id).maybeSingle(),
  ]);
  if (orderResult.error) throw new Error(`reviewDocument: ${orderResult.error.message}`);
  if (slotResult.error) throw new Error(`reviewDocument: ${slotResult.error.message}`);
  const order = orderResult.data as OrderState | null;
  const label = (slotResult.data as Pick<ServiceDocRow, "label"> | null)?.label ?? doc.file_name;

  if (order) {
    const { error: eventError } = await admin.from("user_service_events").insert({
      user_service_id: order.id,
      from_stage: order.stage_key,
      to_stage: order.stage_key,
      note: decision === "approve" ? `Document approved: ${label}` : `Document rejected: ${label}`,
      actor_id: actorId,
    });
    if (eventError) {
      // The review is recorded; the audit row is worth a log line, not a
      // failure the admin would retry into a 409.
      console.error(`reviewDocument: event insert failed for ${doc.id}: ${eventError.message}`);
    }
  } else {
    console.error(`reviewDocument: document ${doc.id} has no order row`);
  }

  let emailed = false;
  if (decision === "reject" && order) {
    const { data: userData, error: userError } = await admin
      .from("users")
      .select("email")
      .eq("id", order.user_id)
      .maybeSingle();
    if (userError) {
      console.error(`reviewDocument: owner lookup failed for ${order.id}: ${userError.message}`);
    }
    const email = (userData as Pick<UserRow, "email"> | null)?.email;
    if (email) {
      const content = documentRejected({
        docLabel: label,
        reason: trimmedReason,
        dashboardUrl: dashboardUrl(origin, `/en/dashboard/orders/${order.id}`),
      });
      const sent = await sendEmail({ to: email, ...content });
      emailed = sent.ok;
    }
  }

  return { document: updated, emailed };
}
