import type { ServiceDocRow, ServiceStageRow, UserDocumentRow, UserServiceNoteRow, UserServiceRow } from "@/lib/db/types";

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

// ---------------------------------------------------------------------------
// The dashboard home: which orders sit in the "In progress" slider, how far
// along each one is, and what the client should do next.
// ---------------------------------------------------------------------------

/** How long a completed order keeps its place in the slider, with its confetti. */
export const RECENTLY_COMPLETED_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Completed less than `RECENTLY_COMPLETED_DAYS` ago, as of `now`. */
export function isRecentlyCompleted(order: Pick<UserServiceRow, "completed_at">, now: Date = new Date()): boolean {
  if (!order.completed_at) return false;
  const completedAt = new Date(order.completed_at).getTime();
  if (Number.isNaN(completedAt)) return false;
  const age = now.getTime() - completedAt;
  return age >= 0 && age < RECENTLY_COMPLETED_DAYS * DAY_MS;
}

/**
 * Whether an order belongs in the "In progress" slider: paid and not
 * complete, or complete for less than seven days. An unpaid order is not in
 * progress (it sits in the purchases table awaiting payment), and a
 * completed order older than a week has moved to history.
 */
export function isInProgress(order: Pick<UserServiceRow, "paid_at" | "completed_at">, now: Date = new Date()): boolean {
  if (!order.paid_at) return false;
  if (!order.completed_at) return true;
  return isRecentlyCompleted(order, now);
}

export type Progress = {
  /** Stages passed, counting the current one only once the order is complete. */
  done: number;
  total: number;
};

/**
 * "x of y stages" from the stage positions. The first stage (awaiting
 * payment) counts as done once the order sits on any later stage; a completed
 * order is `total of total`; an unknown stage key counts as the first one.
 */
export function progressFraction(
  stages: readonly Pick<ServiceStageRow, "key" | "position">[],
  stageKey: string,
  completed: boolean,
): Progress {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const total = ordered.length;
  if (total === 0) return { done: 0, total: 0 };
  if (completed) return { done: total, total };
  const index = Math.max(0, ordered.findIndex((s) => s.key === stageKey));
  return { done: index, total };
}

export type DocumentCounts = {
  /** Slots the service asks for: one per document, per applicant when `per_applicant`. */
  required: number;
  /** Slots whose newest upload is uploaded or approved. */
  received: number;
  /** Slots whose newest upload was rejected and not replaced. */
  rejected: number;
};

/** The document slots of an order and how many hold a file. Same slot rule as the document list. */
export function documentCounts(
  docs: readonly Pick<ServiceDocRow, "id" | "position" | "per_applicant" | "required">[],
  documents: readonly UserDocumentRow[],
  applicants: number,
): DocumentCounts {
  const people = applicants === 2 ? 2 : 1;
  let required = 0;
  let received = 0;
  let rejected = 0;
  for (const doc of docs) {
    if (!doc.required) continue;
    const count = doc.per_applicant ? people : 1;
    for (let index = 0; index < count; index++) {
      required++;
      const latest = latestDocument(documents, doc.id, index as 0 | 1);
      if (latest?.status === "uploaded" || latest?.status === "approved") received++;
      if (latest?.status === "rejected") rejected++;
    }
  }
  return { required, received, rejected };
}

export type NextStepInput = {
  paid: boolean;
  completed: boolean;
  openPendencies: number;
  docs: DocumentCounts;
  /** Files the firm returned, ready to download. */
  deliverables: number;
};

/**
 * The one line under a progress card that says what the client should do.
 * Priorities, highest first: pay, re-send rejected files, answer pendencies,
 * upload what is missing, download what came back, or nothing at all.
 */
export function nextStep(input: NextStepInput): string {
  if (!input.paid) return "Pay to start";
  if (input.docs.rejected > 0) {
    return input.docs.rejected === 1 ? "Send 1 file again" : `Send ${input.docs.rejected} files again`;
  }
  if (input.openPendencies > 0) {
    return input.openPendencies === 1 ? "1 item pending from you" : `${input.openPendencies} items pending from you`;
  }
  const missing = input.docs.required - input.docs.received;
  if (!input.completed && missing > 0) {
    return missing === 1 ? "Upload 1 document" : `Upload ${missing} documents`;
  }
  if (input.completed) {
    return input.deliverables > 0 ? "Your documents are ready to download" : "All done";
  }
  return "Nothing needed from you right now";
}
