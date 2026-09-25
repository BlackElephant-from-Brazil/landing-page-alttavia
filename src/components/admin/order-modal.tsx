import { Download, Eye, FileText } from "lucide-react";

import { contractDrift } from "@/content/contracts/variables";
import { formatDeedDate } from "@/content/power-of-attorney";
import { missingContractApplicant } from "@/lib/contracts/state";
import { contractPersons } from "@/lib/contracts/templates";
import { getOrderDetail } from "@/lib/db/admin-queries";
import { isAgreementTemplate, isDeedTemplate } from "@/lib/documents/templates";
import { isJointDeed } from "@/lib/poa/joint";
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
import { completedBefore, completionGaps } from "./order/completion";
import { ContractActions } from "./order/contract-actions";
import { DeliverableRemove } from "./order/deliverable-remove";
import { DeliverableUpload } from "./order/deliverable-upload";
import { DocumentReview } from "./order/document-review";
import { adminDocumentHref, canShowInline } from "./order/file-links";
import { ReportForm } from "./order/report-form";
import { buildDocumentSlots, unapprovedRequired, type DocumentSlot } from "./order/required-docs";
import { StageControls } from "./order/stage-controls";
import { CONTRACT_TEMPLATE_LABELS } from "./services/editor-model";

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
  downloadAgreement: "Download agreement",
  deedDetails: "Details for the deeds",
  noDetails: "The client has not entered their details yet.",
  agreement: {
    heading: "Service agreement",
    notRequired: "Not required",
    notRequiredBody: "This service has no contract, so nothing is prepared or asked.",
    unpaid: "After payment",
    unpaidBody: "The agreement is prepared once the order is paid and the client confirms their details.",
    waiting: "Waiting for the client's details",
    waitingBody: "The client confirms their details on the order and the agreement is prepared and emailed at once.",
    waitingWithDetails:
      "The client entered their details for a deed but has not confirmed them for the agreement yet. It can be prepared from those details.",
    waitingPartner:
      "The agreement names the client and their partner. It can be prepared once the partner's details are entered too.",
    termsAccepted: (when: string, version: string) =>
      `The client accepted the service terms and the service agreement before paying, on ${when} (terms of ${version}).`,
    prepared: "Prepared",
    version: (n: number) => `version ${n}`,
    preparedOn: (when: string) => `Prepared ${when}`,
    emailedOn: (when: string) => `Emailed ${when}`,
    notEmailed: "Not emailed yet",
    drifted:
      "The client changed their details after this version was prepared. Regenerate and resend to bring the agreement in line.",
    download: "Download",
    downloadLabel: "Download the service agreement",
  },
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
        <AgreementSection detail={detail} />
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
  const pendingRequired = unapprovedRequired(buildSlots(detail));
  const gaps = completionGaps(
    missingDeliverables(detail).map((t) => t.label),
    !!order.report?.trim(),
  );

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
          unapprovedRequired={pendingRequired}
          completedBefore={completedBefore(order, ordered, detail.events)}
          completionGaps={gaps}
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/**
 * The slots and the "not approved yet" count come from
 * ./order/required-docs.ts, the same pure module the stage route enforces
 * its refusal with, so the list the firm reads and what the server allows
 * are one rule.
 *
 * A deed slot carries "Download deed" (the blank deed, filled from the
 * client's details). The signed agreement slot (`template` 'agreement',
 * 0013) carries "Download agreement" instead, the order's prepared
 * agreement from GET /api/orders/[id]/contract?download=1, once it exists;
 * the client's signed copy is the slot's file, reviewed like any other.
 *
 * The couple's joint bank deed (isJointDeed, src/lib/poa/joint.ts, 0016) is
 * one slot naming both people: its "Download deed" asks the route without
 * `?applicant` and shows once both sets of details are there, since the
 * route answers 409 until then.
 */
type Slot = DocumentSlot<ServiceDocRow, UserDocumentRow>;

const APPLICANT = ["Applicant 1", "Applicant 2"] as const;

function buildSlots(detail: AdminOrderDetail): Slot[] {
  return buildDocumentSlots(detail.docs, detail.documents, detail.order.applicants);
}

/**
 * Whether the principal's details exist for that applicant. The deed link
 * shows only then: the route would answer a JSON 409 otherwise, and the
 * details block below the list already says the client has not entered them.
 */
function hasDetails(detail: AdminOrderDetail, applicantIndex: 0 | 1): boolean {
  return detail.applicants.some((a) => a.applicant_index === applicantIndex);
}

/** The deed link of a slot: the joint deed names both people and takes no `?applicant`. */
function deedLink(detail: AdminOrderDetail, slot: Slot): string | null {
  if (!isDeedTemplate(slot.doc.template) || !detail.order.paid_at) return null;
  const base = `/api/orders/${detail.order.id}/poa/${slot.doc.id}`;
  if (isJointDeed(slot.doc, detail.order.applicants)) {
    return hasDetails(detail, 0) && hasDetails(detail, 1) ? base : null;
  }
  return hasDetails(detail, slot.applicantIndex) ? `${base}?applicant=${slot.applicantIndex}` : null;
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
            const deedHref = deedLink(detail, slot);
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
                    {isAgreementTemplate(slot.doc.template) && detail.order.paid_at && detail.contract && (
                      <a
                        href={`/api/orders/${detail.order.id}/contract?download=1`}
                        aria-label={`${copy.downloadAgreement}: ${label}`}
                        className="inline-flex items-center gap-1 rounded-sm text-[0.85rem] font-medium text-navy underline-offset-4 hover:text-gold-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                      >
                        <Download className="size-3.5" aria-hidden />
                        {copy.downloadAgreement}
                      </a>
                    )}
                    {deedHref && (
                      <a
                        href={deedHref}
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
                      {slot.history.length === 1 ? "1 other upload" : `${slot.history.length} other uploads`}
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
 * slot). No row yet reads as one line. The joint bank deed and the Couple
 * package's signed agreement are one slot each but name both people, so
 * they count for applicant 1 as well.
 */
function DeedDetails({ detail, slots }: { detail: AdminOrderDetail; slots: Slot[] }) {
  const both = contractPersons(detail.service.contract_template) === 2;
  const indexes = Array.from(
    new Set(
      slots
        .filter((s) => s.doc.template)
        .flatMap((s) =>
          isJointDeed(s.doc, detail.order.applicants) || (both && isAgreementTemplate(s.doc.template))
            ? [0, 1]
            : [s.applicantIndex],
        ),
    ),
  )
    .filter((index) => index < Math.max(1, detail.order.applicants))
    .sort();
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
              {twoApplicants && <p className="font-medium text-navy">{APPLICANT[index as 0 | 1]}</p>}
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

const fileLinkClass =
  "inline-flex items-center gap-1 rounded-sm font-medium text-navy underline-offset-4 hover:text-gold-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

/**
 * One uploaded file: what it is, and the two ways to open it. **View**
 * shows the file in a new tab, for the types a browser renders (a
 * photograph or a PDF, which is what clients send); **Download** saves it,
 * and is there for every file, a Word document included.
 */
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
        <>
          {canShowInline(doc.mime_type) && (
            <a
              href={adminDocumentHref(doc.id, "view")}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View ${doc.file_name}`}
              className={fileLinkClass}
            >
              <Eye className="size-3.5" aria-hidden />
              View
            </a>
          )}
          <a
            href={adminDocumentHref(doc.id, "download")}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Download ${doc.file_name}`}
            className={fileLinkClass}
          >
            <Download className="size-3.5" aria-hidden />
            Download
          </a>
        </>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Service agreement
// ---------------------------------------------------------------------------

/**
 * The order's service agreement (docs/agreement-contract.md section 7):
 * where it stands, the stored PDF and "Regenerate and resend".
 *
 * Four states, the heading's aside names the one in force: not required (the
 * service has no contract), after payment, waiting for the client's details,
 * prepared (with its version and when it was emailed). An agreement that
 * exists wins over everything else, so one prepared before the service lost
 * its contract still shows and can be regenerated with the model it was made
 * from.
 *
 * The action shows only when the route could act: the order is paid and
 * applicant 0's details exist. With details on the order and no agreement
 * yet (the client typed them for a deed and left the agreement form), the
 * same route prepares the first version. The action keeps its place in the
 * tree in both cases, so its result line survives the refresh that turns
 * "Prepare and send" into "Regenerate and resend".
 *
 * The client can still change applicant 0 after the agreement exists ("Edit
 * your details" on a deed slot): the deeds then print the new details and
 * the agreement keeps the old ones. An amber line above the action says so
 * whenever what the stored version printed differs from what the details
 * would print today (contractDrift). It is a hint only: the client's save is
 * never blocked and nothing is regenerated without the firm's click.
 *
 * The Couple package's one agreement (`couple`, 0017) names applicant 0 and
 * applicant 1: the action waits for both sets of details, as the route does,
 * the drift check compares both people, and the confirmation speaks of both.
 *
 * When the client accepted the terms at checkout (0014), one line says when
 * and which version: the record Patrícia asked for, read only.
 */
function AgreementSection({ detail }: { detail: AdminOrderDetail }) {
  const { order, service, contract } = detail;
  const text = copy.agreement;
  const paid = !!order.paid_at;
  const expected = service.contract_template !== null;
  // The model this agreement is, or will be, made with: the row's once it exists.
  const template = contract?.template ?? service.contract_template;
  const couple = contractPersons(template) === 2;
  const detailsEntered = hasDetails(detail, 0);
  const everyoneEntered = missingContractApplicant(template, detail.applicants) === null;
  const state = contract ? text.prepared : !expected ? text.notRequired : !paid ? text.unpaid : text.waiting;
  const canPrepare = paid && everyoneEntered && (contract !== null || expected);
  // Values against values, never timestamps: the row's updated_at moves on every save, changed or not.
  const first = detail.applicants.find((a) => a.applicant_index === 0) ?? null;
  const second = detail.applicants.find((a) => a.applicant_index === 1) ?? null;
  const drifted =
    contract !== null &&
    contractDrift(contract.variables, contract.template, first ? (couple && second ? [first, second] : first) : null)
      .length > 0;
  const acceptedAt = order.terms_accepted_at ?? null;

  return (
    <section aria-labelledby="order-agreement-heading">
      <SectionHeading id="order-agreement-heading" aside={state}>
        {text.heading}
      </SectionHeading>

      {contract ? (
        <div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-lg border border-navy/10 bg-white px-4 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-navy">
              {CONTRACT_TEMPLATE_LABELS[contract.template]}
              <span className="ml-2 text-[0.75rem] font-normal text-navy-muted">{text.version(contract.version)}</span>
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.85rem] text-navy-soft">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <FileText className="size-3.5 shrink-0 text-gold-dark" aria-hidden />
                <span className="truncate">{contract.file_name}</span>
              </span>
              <span className="text-navy-muted">{formatBytesShort(contract.size_bytes)}</span>
            </p>
            <p className="mt-1 text-[0.82rem] text-navy-muted">
              {text.preparedOn(formatDateTime(contract.generated_at))}
              {" · "}
              {contract.emailed_at ? text.emailedOn(formatDateTime(contract.emailed_at)) : text.notEmailed}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1">
            <a
              href={`/api/orders/${order.id}/contract?download=1`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={text.downloadLabel}
              className="inline-flex items-center gap-1 rounded-sm text-[0.85rem] font-medium text-navy underline-offset-4 hover:text-gold-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <Download className="size-3.5" aria-hidden />
              {text.download}
            </a>
            <Pill tone={contract.emailed_at ? "green" : "amber"}>{contract.emailed_at ? "Emailed" : "Not emailed"}</Pill>
          </div>
        </div>
      ) : (
        <p className="mt-3 max-w-prose text-[0.9rem] leading-relaxed text-navy-muted">
          {!expected
            ? text.notRequiredBody
            : !paid
              ? text.unpaidBody
              : everyoneEntered
                ? text.waitingWithDetails
                : couple && detailsEntered
                  ? text.waitingPartner
                  : text.waitingBody}
        </p>
      )}

      {acceptedAt && (
        <p className="mt-3 max-w-prose text-[0.82rem] leading-relaxed text-navy-muted">
          {text.termsAccepted(formatDateTime(acceptedAt), order.terms_version ?? "an earlier version")}
        </p>
      )}

      {/* Always a child, shown or not, so the action below keeps its place in the tree. */}
      {drifted && (
        <p
          role="status"
          className="mt-3 max-w-prose rounded-sm border border-[#B5731A]/30 bg-[#B5731A]/10 px-4 py-3 text-[0.85rem] leading-relaxed text-[#9A5F0F]"
        >
          {text.drifted}
        </p>
      )}

      {canPrepare && <ContractActions orderId={order.id} exists={contract !== null} couple={couple} />}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Deliverables
// ---------------------------------------------------------------------------

/** The deliverables from the service's list that have no file sent to the client yet. */
function missingDeliverables(detail: AdminOrderDetail) {
  const { templates, files } = detail.deliverables;
  const covered = new Set(
    files.filter((f) => f.status === "ready").map((f) => f.service_deliverable_id).filter(Boolean),
  );
  return templates.filter((t) => !covered.has(t.id));
}

function DeliverablesSection({ detail }: { detail: AdminOrderDetail }) {
  const { templates, files } = detail.deliverables;
  const ready = files.filter((f) => f.status === "ready");
  const missing = missingDeliverables(detail);

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

/** One returned file: Download, and Remove for a file sent by mistake (it asks first, inline, under the row). */
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
      <DeliverableRemove deliverableId={file.id} label={file.label} />
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
