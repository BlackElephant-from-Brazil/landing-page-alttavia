import { EyebrowSolo } from "@/components/ui/eyebrow";
import type { ServiceDocRow, UserDocumentRow, UserServiceApplicantRow, UserServiceRow } from "@/lib/db/types";
import { isJointDeed } from "@/lib/poa/joint";

import { latestDocument } from "../order-status";
import { DocumentSlot, type SlotDocument } from "./document-slot";

/**
 * The documents section of the dashboard, shown once an order is paid.
 *
 * Server component: it takes the order, the service's document list and
 * every upload attempt so far, and lays out one slot per document and per
 * applicant. Two applicants get one group each ("You", "Your partner");
 * documents the service needs only once sit under a third group. A slot
 * shows the latest finished attempt for its document and applicant (a
 * pending row only when it is the only one, see `latestDocument`); earlier
 * rows stay in the table as history and are not shown.
 *
 * A deed slot (`template` set on the document) also gets the principal's
 * details entered for its applicant, from `applicants`, so it knows whether
 * "Download to sign" can go straight to the PDF or has to ask first.
 *
 * Every slot also gets the order's stage, because files are sent while the
 * order sits on the documents stage and only then: a file waiting for review
 * may be replaced or removed there, and once the order moves on the slot
 * takes nothing at all, empty or rejected included. The routes answer to the
 * same rule.
 *
 * The signed agreement slot (`template` 'agreement', 0013) also gets
 * `contractReady`, one boolean the order view derives from its contract row
 * (never the row, whose printed variables stay on the server): the slot
 * opens the agreement only once it exists. It is not per applicant, so on a
 * couple order it sits under "For both of you" and asks both to sign the one
 * paper.
 *
 * The couple's joint bank deed (isJointDeed, migration 0016) is shared as
 * well, so it too sits under "For both of you", as one slot. It gets `joint`
 * and applicant 1's row as `partner` beside applicant 0's, because the one
 * deed names both people and asks for both sets of details.
 */

type Props = {
  order: UserServiceRow;
  docs: ServiceDocRow[];
  uploaded: UserDocumentRow[];
  /** The principal's details entered so far, by applicant index; empty until the first deed is prepared. */
  applicants?: UserServiceApplicantRow[];
  /** The order's service agreement has been prepared, so the signed agreement slot can open it. */
  contractReady?: boolean;
};

type Slot = {
  doc: ServiceDocRow;
  applicantIndex: 0 | 1;
  current?: SlotDocument;
  /** The details for this slot's applicant, on a deed slot; null until entered, and on ordinary slots. */
  applicant: UserServiceApplicantRow | null;
  /** The joint deed names both people: one slot, applicant 0's row above and applicant 1's here. */
  joint: boolean;
  partner: UserServiceApplicantRow | null;
};

const APPLICANT_LABELS = ["You", "Your partner"] as const;
const SHARED_LABEL = "For both of you";

export function DocumentList({ order, docs, uploaded, applicants: applicantRows = [], contractReady = false }: Props) {
  const applicants = order.applicants === 2 ? 2 : 1;
  const slots = buildSlots(docs, uploaded, applicants, applicantRows);
  const received = slots.filter((s) => s.current?.status === "uploaded" || s.current?.status === "approved").length;

  return (
    <section aria-labelledby="documents-heading">
      <EyebrowSolo>Documents</EyebrowSolo>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h2 id="documents-heading" className="font-serif text-[clamp(1.4rem,2.6vw,1.85rem)] leading-tight text-navy">
          Send your documents
        </h2>
        {slots.length > 0 && (
          <p className="text-sm text-navy-muted">
            {received} of {slots.length} received
          </p>
        )}
      </div>
      <p className="mt-3 max-w-prose text-[0.95rem] leading-relaxed text-navy-soft">
        Upload one file per document. We check each one and write to you if anything needs a second look.
      </p>

      {slots.length === 0 ? (
        <p className="mt-6 rounded-lg border border-navy/10 bg-white px-5 py-4 text-[0.95rem] text-navy-soft shadow-[var(--shadow-soft)]">
          Nothing to upload for this service.
        </p>
      ) : applicants === 2 ? (
        <div className="mt-8 space-y-10">
          {APPLICANT_LABELS.map((heading, index) => (
            <Group
              key={heading}
              heading={heading}
              order={order}
              slots={slots.filter((s) => s.doc.per_applicant && s.applicantIndex === index)}
              contractReady={contractReady}
            />
          ))}
          <Group
            heading={SHARED_LABEL}
            order={order}
            slots={slots.filter((s) => !s.doc.per_applicant)}
            contractReady={contractReady}
          />
        </div>
      ) : (
        <SlotList order={order} slots={slots} contractReady={contractReady} className="mt-6" />
      )}
    </section>
  );
}

type GroupProps = { heading: string; order: UserServiceRow; slots: Slot[]; contractReady: boolean };

function Group({ heading, order, slots, contractReady }: GroupProps) {
  if (slots.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-gold-dark">{heading}</h3>
      <SlotList order={order} slots={slots} contractReady={contractReady} className="mt-3" />
    </div>
  );
}

type SlotListProps = { order: UserServiceRow; slots: Slot[]; contractReady: boolean; className?: string };

function SlotList({ order, slots, contractReady, className }: SlotListProps) {
  const twoApplicants = order.applicants === 2;
  return (
    <ul className={`${className ?? ""} space-y-4`.trim()}>
      {slots.map(({ doc, applicantIndex, current, applicant, joint, partner }) => (
        <DocumentSlot
          // The key carries the latest row and its status, so a slot mounts
          // fresh when a refresh brings a new upload or a review back.
          key={`${doc.id}:${applicantIndex}:${current?.id ?? "none"}:${current?.status ?? ""}`}
          userServiceId={order.id}
          serviceDocId={doc.id}
          applicantIndex={applicantIndex}
          label={doc.label}
          note={doc.required ? doc.note : ["Optional.", doc.note].filter(Boolean).join(" ")}
          acceptedMime={doc.accepted_mime}
          maxBytes={doc.max_bytes}
          current={current}
          // A file that waits for review may still be replaced or removed
          // while the order sits on the documents stage; the slot asks the
          // stage for that, and the routes check it again.
          orderStage={order.stage_key}
          template={doc.template}
          applicant={applicant}
          applicantLabel={twoApplicants && doc.per_applicant ? APPLICANT_LABELS[applicantIndex] : undefined}
          // Read by the signed agreement slot only: whether the agreement
          // exists to be opened, and whether two people sign the one paper.
          contractReady={contractReady}
          bothSign={twoApplicants && !doc.per_applicant}
          joint={joint}
          partner={partner}
        />
      ))}
    </ul>
  );
}

/** One slot per document and applicant, in `position` order, each with its latest attempt. */
function buildSlots(
  docs: ServiceDocRow[],
  uploaded: UserDocumentRow[],
  applicants: 1 | 2,
  applicantRows: readonly UserServiceApplicantRow[],
): Slot[] {
  const sorted = [...docs].sort((a, b) => a.position - b.position);
  const slots: Slot[] = [];
  for (const doc of sorted) {
    const count = doc.per_applicant ? applicants : 1;
    const joint = isJointDeed(doc, applicants);
    for (let index = 0; index < count; index++) {
      const applicantIndex = index as 0 | 1;
      const latest = latestDocument(uploaded, doc.id, applicantIndex);
      slots.push({
        doc,
        applicantIndex,
        current: latest
          ? {
              id: latest.id,
              status: latest.status,
              fileName: latest.file_name,
              rejectionReason: latest.rejection_reason,
            }
          : undefined,
        applicant: doc.template ? (applicantRows.find((row) => row.applicant_index === applicantIndex) ?? null) : null,
        joint,
        partner: joint ? (applicantRows.find((row) => row.applicant_index === 1) ?? null) : null,
      });
    }
  }
  return slots;
}
