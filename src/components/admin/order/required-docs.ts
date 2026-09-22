import type { ServiceDocRow, UserDocumentRow } from "@/lib/db/types";
import { DOCUMENTS_STAGE } from "@/lib/documents/stage";

/**
 * One rule, read in two places: the order modal draws the document list
 * from it, and the stage route refuses to leave the documents stage while
 * it is not satisfied (docs/admin-contract.md section 4, changed 2026-09-22
 * on Patrícia's request: moving on used to be a warning, it is now a
 * refusal).
 *
 * Pure on purpose. No React, no database client, no `server-only`, so the
 * server module behind the refusal and the component that disables the
 * buttons agree by construction instead of by comment. The rows are typed
 * structurally, by what the rule reads, so a caller that selected four
 * columns and a caller holding the whole row both fit.
 *
 * A slot is one document a service asks for, once per applicant when the
 * slot says so. What counts for a slot is its latest upload, never an
 * earlier one: a file approved and then replaced leaves the slot waiting
 * again, which is what an admin looking at the list sees.
 *
 * "Latest" skips a `pending` row while the slot holds anything else, the
 * same rule as `latestDocument` on the client side and as the ordering in
 * `admin_order_summary` (0007_one_unit_poa.sql). A pending row is an upload
 * that never finished; letting it stand for the slot would hide the file the
 * client did send, take the Approve and Reject buttons away from it and, now
 * that `advanceStage` refuses on this same count, block the order for good,
 * since nothing in /admin can clear such a row.
 */

/**
 * The stage an order sits on while the client sends their documents, one
 * value for the whole codebase: it is defined in src/lib/documents/stage.ts
 * (which the client slot also reads) and passed on from here, so the admin
 * side and the client side can never drift apart.
 */
export { DOCUMENTS_STAGE };

/** What the rule reads from a service's document slot. */
export type SlotDoc = Pick<ServiceDocRow, "id" | "required" | "per_applicant" | "position">;

/** What the rule reads from an upload attempt. */
export type SlotUpload = Pick<UserDocumentRow, "service_doc_id" | "applicant_index" | "status" | "created_at">;

export type DocumentSlot<D extends SlotDoc, U extends SlotUpload> = {
  doc: D;
  applicantIndex: 0 | 1;
  /** The attempt this slot stands for, or null while nothing has arrived. */
  latest: U | null;
  /**
   * Every other attempt, newest first. Usually the earlier ones; an upload
   * that never finished sits here too, above the file it failed to replace.
   */
  history: U[];
};

/**
 * Every slot of the order, in the service's own order, each with the
 * uploads that belong to it. `applicants` is the order's own count: a
 * per-applicant slot on a couple order is two slots.
 */
export function buildDocumentSlots<D extends SlotDoc, U extends SlotUpload>(
  docs: readonly D[],
  documents: readonly U[],
  applicants: number,
): DocumentSlot<D, U>[] {
  const people = applicants === 2 ? 2 : 1;
  const slots: DocumentSlot<D, U>[] = [];

  for (const doc of [...docs].sort((a, b) => a.position - b.position)) {
    const count = doc.per_applicant ? people : 1;
    for (let index = 0; index < count; index++) {
      const applicantIndex = index as 0 | 1;
      const rows = documents
        .filter((d) => d.service_doc_id === doc.id && d.applicant_index === applicantIndex)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
      // Newest first, so the first row that is not `pending` is the one the
      // slot stands for; a slot with nothing but unfinished uploads shows
      // the newest of those, which is what the client sees too.
      const latest = rows.find((row) => row.status !== "pending") ?? rows[0] ?? null;
      slots.push({ doc, applicantIndex, latest, history: rows.filter((row) => row !== latest) });
    }
  }

  return slots;
}

/** Required slots whose latest upload is not approved. Zero means the order may move on. */
export function unapprovedRequired(slots: readonly DocumentSlot<SlotDoc, SlotUpload>[]): number {
  return slots.filter((slot) => slot.doc.required && slot.latest?.status !== "approved").length;
}

/**
 * The same answer straight from the rows, for the server: how many required
 * slots are still waiting for an approval.
 */
export function unapprovedRequiredFor(
  docs: readonly SlotDoc[],
  documents: readonly SlotUpload[],
  applicants: number,
): number {
  return unapprovedRequired(buildDocumentSlots(docs, documents, applicants));
}
