import { Download, FileText } from "lucide-react";

import { formatDeedDate } from "@/content/power-of-attorney";
import { getOrderDetail } from "@/lib/db/admin-queries";
import type {
  AdminOrderDetail,
  ServiceDocRow,
  UserDocumentRow,
  UserServiceApplicantRow,
  UserServiceDeliverableRow,
} from "@/lib/db/types";
import { requireAdminPage } from "@/lib/supabase/admin-user";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/cn";

import { Pill } from "./data-table";
import { formatBytesShort, formatDate, formatDateTime, formatEuro, humanizeKey } from "./lib/format";
import { isUuid } from "./lib/params";
import { Modal } from "./modal";
import { DeliverableUpload } from "./order/deliverable-upload";
import { DocumentReview } from "./order/document-review";
import { ReportForm } from "./order/report-form";
import { StageControls } from "./order/stage-controls";

/**
 * The order detail, opened by `?order=<id>` on the overview and on the
 * orders page. Contract (docs/admin-contract.md) section 7.
 *
 * Server component: it reads the id from the page's search params, loads
 * everything with the user client (RLS `is_admin()` decides what comes
 * back) and renders the sections into the client `<dialog>` wrapper. Every
 * action inside is a small client island that posts to a route and
 * refreshes; the URL keeps `?order=`, so the modal stays open and shows
 * the new state.
 *
 * An id that is not a UUID or is unknown still opens the modal, with one
 * line and the close button, so a stale link never leaves the page in a
 * half state.
 */

const TITLE_ID = "order-modal-title";

const copy = {
  notFound: "This order is not on record.",
  stage: "Stage",
  documents: "Documents",
  downloadDeed: "Download deed",
  deedDetails: "Details for the deeds",
  noDetails: "The client has not entered their details yet.",
  deliverables: "Deliverables",
  report: "Report",
  answers: "Answers from the form",
  events: "History",
} as const;

export async function OrderModal({ orderId }: { orderId: string | undefined }) {
  await requireAdminPage();
  if (!orderId) return null;

  if (!isUuid(orderId)) {
    return <NotFound />;
  }

  const supabase = await createClient();
  const detail = await getOrderDetail(supabase, orderId);
  if (!detail) return <NotFound />;

  return (
    <Modal key={detail.order.id} titleId={TITLE_ID} title={<Header detail={detail} />}>
      <div className="space-y-10">
        <StageSection detail={detail} />
        <DocumentsSection detail={detail} />
        <DeliverablesSection detail={detail} />
        <ReportSection detail={detail} />
        <AnswersSection detail={detail} />
        <EventsSection detail={detail} />
      </div>
    </Modal>
  );
}

function NotFound() {
  return (
    <Modal
      titleId={TITLE_ID}
      title={
        <h2 id={TITLE_ID} className="font-serif text-xl text-navy">
          Order
        </h2>
      }
    >
      <p className="text-[0.95rem] text-navy-soft">{copy.notFound}</p>
    </Modal>
  );
}

function stageLabel(detail: AdminOrderDetail, key: string): string {
  return detail.stages.find((s) => s.key === key)?.label ?? humanizeKey(key);
}

function Header({ detail }: { detail: AdminOrderDetail }) {
  const { order, user, service } = detail;

  return (
    <div>
      <p className="text-[0.68rem] font-medium uppercase tracking-[0.28em] text-gold-dark">Order</p>
      <h2 id={TITLE_ID} className="mt-1 truncate font-serif text-xl leading-snug text-navy">
        {user.email}
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[0.85rem] sm:grid-cols-4">
        <Fact label="Service" value={service.name} />
        <Fact label="Amount" value={formatEuro(order.total_cents)} />
        <Fact label="Paid on" value={order.paid_at ? formatDate(order.paid_at) : "Not yet"} />
        <Fact label="Stage" value={stageLabel(detail, order.stage_key)} />
      </dl>
      {(user.full_name || user.phone) && (
        <p className="mt-2 text-[0.82rem] text-navy-muted">
          {[user.full_name, user.phone].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-navy-muted">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-navy">{value}</dd>
    </div>
  );
}

function SectionHeading({ id, children, aside }: { id: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 id={id} className="text-xs font-medium uppercase tracking-[0.18em] text-navy-muted">
        {children}
      </h3>
      {aside && <p className="text-[0.8rem] text-navy-muted">{aside}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage
// ---------------------------------------------------------------------------

function StageSection({ detail }: { detail: AdminOrderDetail }) {
  const { order, stages } = detail;
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const currentIndex = ordered.findIndex((s) => s.key === order.stage_key);
  const unapprovedRequired = buildSlots(detail).filter(
    (slot) => slot.doc.required && slot.latest?.status !== "approved",
  ).length;

  return (
    <section aria-labelledby="order-stage-heading">
      <SectionHeading
        id="order-stage-heading"
        aside={order.completed_at ? `Completed ${formatDate(order.completed_at)}` : undefined}
      >
        {copy.stage}
      </SectionHeading>
      <ol className="mt-3 flex flex-wrap gap-2" aria-label="Stages">
        {ordered.map((stage, index) => {
          const done = index < currentIndex;
          const current = index === currentIndex;
          return (
            <li
              key={stage.id}
              aria-current={current ? "step" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[0.8rem]",
                current && "border-gold bg-gold/15 font-medium text-navy",
                done && "border-navy/10 bg-navy/5 text-navy-soft",
                !done && !current && "border-navy/10 bg-white text-navy-muted",
              )}
            >
              <span className="text-[0.7rem] tabular-nums text-navy-muted">{index + 1}</span>
              {stage.label}
              {done && <span className="sr-only"> (done)</span>}
              {current && <span className="sr-only"> (current)</span>}
            </li>
          );
        })}
      </ol>
      <div className="mt-4">
        <StageControls
          key={order.stage_key}
          orderId={order.id}
          stages={ordered}
          currentKey={order.stage_key}
          paid={!!order.paid_at}
          unapprovedRequired={unapprovedRequired}
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

type Slot = {
  doc: ServiceDocRow;
  applicantIndex: 0 | 1;
  latest: UserDocumentRow | null;
  history: UserDocumentRow[];
};

const APPLICANT = ["Applicant 1", "Applicant 2"] as const;

function buildSlots(detail: AdminOrderDetail): Slot[] {
  const applicants = detail.order.applicants === 2 ? 2 : 1;
  const slots: Slot[] = [];
  for (const doc of [...detail.docs].sort((a, b) => a.position - b.position)) {
    const count = doc.per_applicant ? applicants : 1;
    for (let index = 0; index < count; index++) {
      const applicantIndex = index as 0 | 1;
      const rows = detail.documents
        .filter((d) => d.service_doc_id === doc.id && d.applicant_index === applicantIndex)
        .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
      const latest = rows.length > 0 ? rows[rows.length - 1] : null;
      slots.push({ doc, applicantIndex, latest, history: rows.slice(0, -1).reverse() });
    }
  }
  return slots;
}

const DOC_PILL: Record<UserDocumentRow["status"], { label: string; tone: "muted" | "gold" | "navy" | "clay" }> = {
  pending: { label: "Not arrived", tone: "muted" },
  uploaded: { label: "To review", tone: "gold" },
  approved: { label: "Approved", tone: "navy" },
  rejected: { label: "Rejected", tone: "clay" },
};

function DocumentsSection({ detail }: { detail: AdminOrderDetail }) {
  const slots = buildSlots(detail);
  const approved = slots.filter((s) => s.doc.required && s.latest?.status === "approved").length;
  const required = slots.filter((s) => s.doc.required).length;
  const twoApplicants = detail.order.applicants === 2;

  return (
    <section aria-labelledby="order-documents-heading">
      <SectionHeading id="order-documents-heading" aside={required > 0 ? `${approved} of ${required} required approved` : undefined}>
        {copy.documents}
      </SectionHeading>

      {!detail.order.paid_at ? (
        <p className="mt-3 text-[0.9rem] text-navy-muted">Documents open once the order is paid.</p>
      ) : slots.length === 0 ? (
        <p className="mt-3 text-[0.9rem] text-navy-muted">This service asks for no documents.</p>
      ) : (
        <ul className="mt-3 divide-y divide-navy/10 rounded-lg border border-navy/10 bg-white">
          {slots.map((slot) => {
            const label = twoApplicants && slot.doc.per_applicant ? `${slot.doc.label} · ${APPLICANT[slot.applicantIndex]}` : slot.doc.label;
            const pill = slot.latest ? DOC_PILL[slot.latest.status] : { label: "Waiting", tone: "muted" as const };
            return (
              <li key={`${slot.doc.id}:${slot.applicantIndex}`} className="px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-navy">
                      {label}
                      {!slot.doc.required && <span className="ml-2 text-[0.75rem] font-normal text-navy-muted">optional</span>}
                    </p>
                    {slot.latest && slot.latest.status !== "pending" && (
                      <DocumentLine doc={slot.latest} />
                    )}
                    {slot.latest?.status === "rejected" && slot.latest.rejection_reason && (
                      <p className="mt-2 rounded-sm border border-clay/20 bg-clay/5 px-3 py-2 text-[0.85rem] leading-relaxed text-navy">
                        {slot.latest.rejection_reason}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1">
                    {slot.doc.template && (
                      <a
                        href={`/api/orders/${detail.order.id}/poa/${slot.doc.id}?applicant=${slot.applicantIndex}`}
                        aria-label={`${copy.downloadDeed}: ${label}`}
                        className="inline-flex items-center gap-1 rounded-sm text-[0.85rem] font-medium text-navy underline-offset-4 hover:text-gold-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                      >
                        <Download className="size-3.5" aria-hidden />
                        {copy.downloadDeed}
                      </a>
                    )}
                    <Pill tone={pill.tone}>{pill.label}</Pill>
                  </div>
                </div>

                {slot.latest?.status === "uploaded" && <DocumentReview documentId={slot.latest.id} label={slot.doc.label} />}

                {slot.history.length > 0 && (
                  <details className="mt-3 text-[0.85rem]">
                    <summary className="cursor-pointer text-navy-muted underline-offset-4 hover:text-navy hover:underline">
                      {slot.history.length === 1 ? "1 earlier upload" : `${slot.history.length} earlier uploads`}
                    </summary>
                    <ul className="mt-2 space-y-2 border-l border-navy/10 pl-3">
                      {slot.history.map((doc) => (
                        <li key={doc.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <Pill tone={DOC_PILL[doc.status].tone}>{DOC_PILL[doc.status].label}</Pill>
                          <DocumentLine doc={doc} compact />
                          {doc.rejection_reason && <span className="w-full text-navy-muted">{doc.rejection_reason}</span>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {detail.order.paid_at && <DeedDetails detail={detail} slots={slots} />}
    </section>
  );
}

/**
 * The principal's details the deeds are filled with, once per applicant who
 * has a deed slot on the order (the bundle and the couple package have two
 * deeds per person, so the block sits under the list rather than under each
 * slot). No row yet reads as one line.
 */
function DeedDetails({ detail, slots }: { detail: AdminOrderDetail; slots: Slot[] }) {
  const indexes = Array.from(new Set(slots.filter((s) => s.doc.template).map((s) => s.applicantIndex))).sort();
  if (indexes.length === 0) return null;
  const twoApplicants = detail.order.applicants === 2;

  return (
    <div className="mt-4">
      <h4 className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-navy-muted">{copy.deedDetails}</h4>
      <ul className="mt-2 divide-y divide-navy/10 rounded-lg border border-navy/10 bg-white">
        {indexes.map((index) => {
          const row = detail.applicants.find((a) => a.applicant_index === index) ?? null;
          return (
            <li key={index} className="px-4 py-4">
              {twoApplicants && <p className="font-medium text-navy">{APPLICANT[index]}</p>}
              {row ? (
                <ApplicantFacts row={row} className={twoApplicants ? "mt-3" : undefined} />
              ) : (
                <p className={cn("text-[0.85rem] text-navy-muted", twoApplicants && "mt-1")}>{copy.noDetails}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const DEED_DATE_LANG = "en";

/** The nine fields as they print in the deed, dates as "12 March 2026". */
function ApplicantFacts({ row, className }: { row: UserServiceApplicantRow; className?: string }) {
  const facts: [string, string][] = [
    ["Full name", row.full_name],
    ["Referred to as", row.gender === "f" ? "She" : "He"],
    ["Place of birth", row.birth_place],
    ["Date of birth", formatDeedDate(row.birth_date, DEED_DATE_LANG)],
    ["Passport number", row.passport_number],
    ["Issuing authority", row.passport_issuer],
    ["Date of issue", formatDeedDate(row.passport_issued_on, DEED_DATE_LANG)],
    ["Expiry date", formatDeedDate(row.passport_expires_on, DEED_DATE_LANG)],
    ["Tax residence address", row.tax_address],
  ];
  return (
    <dl className={cn("grid gap-x-6 gap-y-2 text-[0.85rem] sm:grid-cols-2", className)}>
      {facts.map(([label, value]) => (
        <div key={label} className={cn("min-w-0", label === "Tax residence address" && "sm:col-span-2")}>
          <dt className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-navy-muted">{label}</dt>
          <dd className="mt-0.5 break-words font-medium text-navy">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DocumentLine({ doc, compact }: { doc: UserDocumentRow; compact?: boolean }) {
  const when = doc.reviewed_at ? `reviewed ${formatDate(doc.reviewed_at)}` : doc.uploaded_at ? `uploaded ${formatDate(doc.uploaded_at)}` : "";
  return (
    <span className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.85rem] text-navy-soft", !compact && "mt-1")}>
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <FileText className="size-3.5 shrink-0 text-gold-dark" aria-hidden />
        <span className="truncate">{doc.file_name}</span>
      </span>
      <span className="text-navy-muted">{formatBytesShort(doc.size_bytes)}</span>
      {when && <span className="text-navy-muted">{when}</span>}
      {doc.status !== "pending" && (
        <a
          href={`/api/admin/documents/${doc.id}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Download ${doc.file_name}`}
          className="inline-flex items-center gap-1 rounded-sm font-medium text-navy underline-offset-4 hover:text-gold-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <Download className="size-3.5" aria-hidden />
          Download
        </a>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Deliverables
// ---------------------------------------------------------------------------

function DeliverablesSection({ detail }: { detail: AdminOrderDetail }) {
  const { templates, files } = detail.deliverables;
  const ready = files.filter((f) => f.status === "ready");
  const covered = new Set(ready.map((f) => f.service_deliverable_id).filter(Boolean));
  const missing = templates.filter((t) => !covered.has(t.id));

  return (
    <section aria-labelledby="order-deliverables-heading">
      <SectionHeading
        id="order-deliverables-heading"
        aside={templates.length > 0 ? `${templates.length - missing.length} of ${templates.length} from the list` : undefined}
      >
        {copy.deliverables}
      </SectionHeading>

      {ready.length === 0 ? (
        <p className="mt-3 text-[0.9rem] text-navy-muted">No file returned to the client yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-navy/10 rounded-lg border border-navy/10 bg-white">
          {ready.map((file) => (
            <DeliverableLine key={file.id} file={file} />
          ))}
        </ul>
      )}

      {missing.length > 0 && (
        <p className="mt-3 text-[0.82rem] text-navy-muted">
          Still to send: {missing.map((t) => t.label).join(", ")}.
        </p>
      )}

      {detail.order.paid_at ? (
        <DeliverableUpload orderId={detail.order.id} templates={templates} />
      ) : (
        <p className="mt-3 text-[0.9rem] text-navy-muted">Files can be returned once the order is paid.</p>
      )}
    </section>
  );
}

function DeliverableLine({ file }: { file: UserServiceDeliverableRow }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-navy">{file.label}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[0.82rem] text-navy-muted">
          {file.file_name && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <FileText className="size-3.5 shrink-0 text-gold-dark" aria-hidden />
              <span className="truncate">{file.file_name}</span>
            </span>
          )}
          {file.size_bytes !== null && <span>{formatBytesShort(file.size_bytes)}</span>}
          <span>{formatDate(file.updated_at)}</span>
        </p>
      </div>
      <a
        href={`/api/admin/deliverables/${file.id}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Download ${file.label}`}
        className="inline-flex items-center gap-1 rounded-sm text-[0.85rem] font-medium text-navy underline-offset-4 hover:text-gold-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        <Download className="size-3.5" aria-hidden />
        Download
      </a>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Report, answers, events
// ---------------------------------------------------------------------------

function ReportSection({ detail }: { detail: AdminOrderDetail }) {
  return (
    <section aria-labelledby="order-report-heading">
      <SectionHeading id="order-report-heading">{copy.report}</SectionHeading>
      <div className="mt-3">
        <ReportForm key={detail.order.updated_at} orderId={detail.order.id} initial={detail.order.report ?? ""} />
      </div>
    </section>
  );
}

function AnswersSection({ detail }: { detail: AdminOrderDetail }) {
  if (detail.answers.length === 0) return null;
  return (
    <section aria-labelledby="order-answers-heading">
      <SectionHeading id="order-answers-heading">{copy.answers}</SectionHeading>
      <dl className="mt-3 divide-y divide-navy/10 rounded-lg border border-navy/10 bg-white">
        {detail.answers.map((item, i) => (
          <div key={`${item.label}-${i}`} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] sm:gap-6">
            <dt className="text-[0.85rem] text-navy-soft">{item.label}</dt>
            <dd className="text-[0.9rem] font-medium text-navy">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function EventsSection({ detail }: { detail: AdminOrderDetail }) {
  const events = [...detail.events].reverse();
  return (
    <section aria-labelledby="order-events-heading">
      <SectionHeading id="order-events-heading">{copy.events}</SectionHeading>
      {events.length === 0 ? (
        <p className="mt-3 text-[0.9rem] text-navy-muted">No stage changes recorded.</p>
      ) : (
        <ol className="mt-3 space-y-2 text-[0.85rem]">
          {events.map((event) => (
            <li key={event.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="w-[9.5rem] shrink-0 tabular-nums text-navy-muted">{formatDateTime(event.created_at)}</span>
              <span className="text-navy">
                {event.from_stage ? `${stageLabel(detail, event.from_stage)} to ${stageLabel(detail, event.to_stage)}` : `Created on ${stageLabel(detail, event.to_stage)}`}
              </span>
              {event.note && <span className="text-navy-muted">{event.note}</span>}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 text-[0.75rem] text-navy-muted">
        Order created {formatDateTime(detail.order.created_at)} · id {detail.order.id}
      </p>
    </section>
  );
}
