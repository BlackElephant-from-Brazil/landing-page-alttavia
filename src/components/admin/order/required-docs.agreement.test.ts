import { describe, expect, it } from "vitest";

import { SIGNED_AGREEMENT_SLOT } from "@/lib/apply/documents";

import { buildDocumentSlots, unapprovedRequired, unapprovedRequiredFor, type SlotDoc, type SlotUpload } from "./required-docs";

/**
 * The signed agreement slot (0013_signed_agreement_slot.sql) against the rule
 * that holds an order on the documents stage. The slot is required and
 * `per_applicant` false, so it is one slot per order: on the couple package
 * both people sign one paper and the order waits for that one approval, not
 * two. The rule needed no change for it; these tests say so.
 */

const PASSPORT = doc("passport", 1, { per_applicant: true });
const DEED = doc("poa_nif", 3, { per_applicant: true });
const AGREEMENT = doc(SIGNED_AGREEMENT_SLOT.key, 4, {
  per_applicant: SIGNED_AGREEMENT_SLOT.perApplicant,
  required: SIGNED_AGREEMENT_SLOT.required,
});

function doc(id: string, position: number, extra: Partial<SlotDoc> = {}): SlotDoc {
  return { id, position, required: true, per_applicant: false, ...extra };
}

let clock = 0;

function upload(docId: string, status: SlotUpload["status"], applicant: 0 | 1 = 0): SlotUpload {
  clock++;
  return {
    service_doc_id: docId,
    applicant_index: applicant,
    status,
    created_at: new Date(Date.UTC(2026, 8, 25, 10, 0, clock)).toISOString(),
  };
}

/** Everything but the agreement approved, for one person or two. */
function othersApproved(applicants: 1 | 2): SlotUpload[] {
  const rows: SlotUpload[] = [];
  for (let index = 0; index < applicants; index++) {
    rows.push(upload(PASSPORT.id, "approved", index as 0 | 1), upload(DEED.id, "approved", index as 0 | 1));
  }
  return rows;
}

describe("the signed agreement on the documents stage", () => {
  it("is one slot on a couple order, under applicant index 0", () => {
    const slots = buildDocumentSlots([PASSPORT, DEED, AGREEMENT], [], 2);
    const agreement = slots.filter((s) => s.doc.id === AGREEMENT.id);

    expect(slots).toHaveLength(5);
    expect(agreement).toHaveLength(1);
    expect(agreement[0].applicantIndex).toBe(0);
  });

  it.each([1, 2] as const)("holds a %s applicant order until the signed copy is approved", (applicants) => {
    const docs = [PASSPORT, DEED, AGREEMENT];
    const rest = othersApproved(applicants);

    expect(unapprovedRequiredFor(docs, rest, applicants)).toBe(1);
    expect(unapprovedRequiredFor(docs, [...rest, upload(AGREEMENT.id, "uploaded")], applicants)).toBe(1);
    expect(unapprovedRequiredFor(docs, [...rest, upload(AGREEMENT.id, "rejected")], applicants)).toBe(1);
    expect(unapprovedRequiredFor(docs, [...rest, upload(AGREEMENT.id, "approved")], applicants)).toBe(0);
  });

  it("asks for one approval on a couple order, not one per person", () => {
    const docs = [PASSPORT, DEED, AGREEMENT];
    const rows = [...othersApproved(2), upload(AGREEMENT.id, "approved", 0)];

    expect(unapprovedRequired(buildDocumentSlots(docs, rows, 2))).toBe(0);
  });

  it("does not count a stray row under index 1 for the shared slot", () => {
    // upload-url refuses index 1 on a slot that is not per applicant; were a
    // row to exist anyway, it belongs to no slot and approves nothing.
    const docs = [PASSPORT, DEED, AGREEMENT];
    const rows = [...othersApproved(2), upload(AGREEMENT.id, "approved", 1)];

    expect(unapprovedRequiredFor(docs, rows, 2)).toBe(1);
  });

  it("lets the order go once the newest signed copy is approved, after a rejection", () => {
    const docs = [PASSPORT, DEED, AGREEMENT];
    const rows = [...othersApproved(1), upload(AGREEMENT.id, "rejected"), upload(AGREEMENT.id, "approved")];

    expect(unapprovedRequiredFor(docs, rows, 1)).toBe(0);
  });
});
