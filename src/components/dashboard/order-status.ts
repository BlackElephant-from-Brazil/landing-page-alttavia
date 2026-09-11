import type { ServiceDocRow, UserDocumentRow, UserServiceNoteRow, UserServiceRow } from "@/lib/db/types";

/**
 * Pure helpers behind the client's order view and the orders table. No
 * React, no network, so they are unit tested in order-status.test.ts and
 * safe to import from server and client components alike.
 */

/** The three states the client reads an order in. */
export type OrderStatus = "awaiting_payment" | "in_progress" | "completed";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: "Awaiting payment",
  in_progress: "In progress",
  completed: "Completed",
};

/** Completed wins over paid; unpaid is awaiting payment whatever the stage says. */
export function orderStatus(order: Pick<UserServiceRow, "paid_at" | "completed_at">): OrderStatus {
  if (order.completed_at) return "completed";
  if (order.paid_at) return "in_progress";
  return "awaiting_payment";
}

/** "11 September 2026", the way a lawyer's letter writes it, in the firm's time zone. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Lisbon",
  });
}

/**
 * The row a document slot shows: the newest row that is not `pending`, or
 * the pending one when it is the only row. A pending row is an upload that
 * never finished; it must not hide the reviewed file under it. Same rule as
 * the latest status in admin_order_summary.
 */
export function latestDocument(
  documents: readonly UserDocumentRow[],
  serviceDocId: string,
  applicantIndex: 0 | 1,
): UserDocumentRow | null {
  let latest: UserDocumentRow | null = null;
  let pending: UserDocumentRow | null = null;
  for (const row of documents) {
    if (row.service_doc_id !== serviceDocId || row.applicant_index !== applicantIndex) continue;
    if (row.status === "pending") {
      if (!pending || row.created_at > pending.created_at) pending = row;
      continue;
    }
    if (!latest || row.created_at > latest.created_at) latest = row;
  }
  return latest ?? pending;
}

export type RejectedSlot = {
  docId: string;
  label: string;
  applicantIndex: 0 | 1;
  reason: string | null;
  fileName: string;
};

const APPLICANT_LABELS = ["You", "Your partner"] as const;

/**
 * Slots whose newest upload was rejected and not replaced, in document
 * order, then by applicant. A slot is one document and one applicant; the
 * latest row decides (see `latestDocument`), so a rejected file that was
 * replaced by a new upload no longer counts and an upload that never
 * finished does not hide it. Same rule as `docs_rejected` in
 * admin_order_summary.
 */
export function rejectedSlots(
  docs: readonly ServiceDocRow[],
  documents: readonly UserDocumentRow[],
  applicants: number,
): RejectedSlot[] {
  const people = applicants === 2 ? 2 : 1;
  const out: RejectedSlot[] = [];
  for (const doc of [...docs].sort((a, b) => a.position - b.position)) {
    const count = doc.per_applicant ? people : 1;
    for (let index = 0; index < count; index++) {
      const applicantIndex = index as 0 | 1;
      const latest = latestDocument(documents, doc.id, applicantIndex);
      if (latest?.status === "rejected") {
        out.push({
          docId: doc.id,
          label: doc.label,
          applicantIndex,
          reason: latest.rejection_reason,
          fileName: latest.file_name,
        });
      }
    }
  }
  return out;
}

/** "Passport (Your partner)" for a couple, "Passport" for one person. */
export function slotName(slot: Pick<RejectedSlot, "label" | "applicantIndex">, applicants: number): string {
  if (applicants === 2) return `${slot.label} (${APPLICANT_LABELS[slot.applicantIndex]})`;
  return slot.label;
}

/** Client notes split into what still needs the client and what is settled; open ones newest first, resolved ones newest first. */
export function splitNotes(notes: readonly UserServiceNoteRow[]): {
  open: UserServiceNoteRow[];
  resolved: UserServiceNoteRow[];
} {
  const clientNotes = notes.filter((n) => n.audience === "client");
  const byNewest = (a: UserServiceNoteRow, b: UserServiceNoteRow) => (a.created_at < b.created_at ? 1 : -1);
  return {
    open: clientNotes.filter((n) => n.resolved_at === null).sort(byNewest),
    resolved: clientNotes.filter((n) => n.resolved_at !== null).sort(byNewest),
  };
}

/**
 * The report as paragraphs: blank lines separate them, single line breaks
 * inside a paragraph are kept for <RichText /> to render as text. Leading
 * and trailing blank lines are dropped. Empty input gives no paragraphs.
 */
export function reportParagraphs(report: string | null | undefined): string[] {
  if (!report) return [];
  return report
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** True when the wizard's answers were stored with the order; a gallery order has none. */
export function hasAnswers(snapshot: unknown): boolean {
  return !!snapshot && typeof snapshot === "object" && Object.keys(snapshot as object).length > 0;
}
