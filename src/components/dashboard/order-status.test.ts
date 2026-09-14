import { describe, expect, it } from "vitest";

import type { ServiceDocRow, UserDocumentRow } from "@/lib/db/types";

import {
  documentCounts,
  hasAnswers,
  isInProgress,
  isRecentlyCompleted,
  latestDocument,
  nextStep,
  orderStatus,
  progressFraction,
  rejectedSlots,
  reportParagraphs,
  slotName,
} from "./order-status";

function doc(id: string, position: number, perApplicant = true, template: ServiceDocRow["template"] = null): ServiceDocRow {
  return {
    id,
    service_id: "svc",
    key: id,
    label: id === "passport" ? "Passport" : "Proof of address",
    note: null,
    accepted_mime: ["application/pdf"],
    max_bytes: 1,
    per_applicant: perApplicant,
    required: true,
    position,
    template,
  };
}

function upload(
  id: string,
  serviceDocId: string,
  applicantIndex: 0 | 1,
  status: UserDocumentRow["status"],
  createdAt: string,
  reason: string | null = null,
): UserDocumentRow {
  return {
    id,
    user_service_id: "order",
    service_doc_id: serviceDocId,
    applicant_index: applicantIndex,
    storage_key: `k/${id}`,
    file_name: `${id}.pdf`,
    mime_type: "application/pdf",
    size_bytes: 1,
    status,
    rejection_reason: reason,
    uploaded_at: createdAt,
    reviewed_at: null,
    reviewed_by: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

describe("orderStatus", () => {
  it("reads completed over paid over unpaid", () => {
    expect(orderStatus({ paid_at: null, completed_at: null })).toBe("awaiting_payment");
    expect(orderStatus({ paid_at: "2026-09-01T00:00:00Z", completed_at: null })).toBe("in_progress");
    expect(orderStatus({ paid_at: "2026-09-01T00:00:00Z", completed_at: "2026-09-10T00:00:00Z" })).toBe("completed");
  });
});

describe("rejectedSlots", () => {
  const docs = [doc("proof_of_address", 2, false), doc("passport", 1)];

  it("lists the slots whose newest upload is rejected, in document then applicant order", () => {
    const documents = [
      upload("a", "passport", 0, "rejected", "2026-09-01T00:00:00Z", "Blurry scan"),
      upload("b", "passport", 1, "approved", "2026-09-01T00:00:00Z"),
      upload("c", "proof_of_address", 0, "rejected", "2026-09-02T00:00:00Z", null),
    ];
    const slots = rejectedSlots(docs, documents, 2);
    expect(slots.map((s) => [s.docId, s.applicantIndex, s.reason])).toEqual([
      ["passport", 0, "Blurry scan"],
      ["proof_of_address", 0, null],
    ]);
  });

  it("drops a rejected file once a newer upload replaced it", () => {
    const documents = [
      upload("a", "passport", 0, "rejected", "2026-09-01T00:00:00Z", "Expired"),
      upload("b", "passport", 0, "uploaded", "2026-09-03T00:00:00Z"),
    ];
    expect(rejectedSlots(docs, documents, 1)).toEqual([]);
  });

  it("still lists a rejected file when a newer upload never finished", () => {
    const documents = [
      upload("a", "passport", 0, "rejected", "2026-09-01T00:00:00Z", "Expired"),
      upload("b", "passport", 0, "pending", "2026-09-03T00:00:00Z"),
    ];
    expect(rejectedSlots(docs, documents, 1).map((s) => s.reason)).toEqual(["Expired"]);
  });

  it("ignores the partner's slots on a single applicant order", () => {
    const documents = [upload("a", "passport", 1, "rejected", "2026-09-01T00:00:00Z", "x")];
    expect(rejectedSlots(docs, documents, 1)).toEqual([]);
  });

  it("names the applicant only for a couple", () => {
    const slot = { label: "Passport", applicantIndex: 1 as const };
    expect(slotName(slot, 2)).toBe("Passport (Your partner)");
    expect(slotName(slot, 1)).toBe("Passport");
  });
});

describe("latestDocument", () => {
  it("prefers the newest row that is not pending", () => {
    const documents = [
      upload("old", "passport", 0, "rejected", "2026-09-01T00:00:00Z"),
      upload("new", "passport", 0, "uploaded", "2026-09-02T00:00:00Z"),
      upload("stuck", "passport", 0, "pending", "2026-09-03T00:00:00Z"),
      upload("other", "passport", 1, "approved", "2026-09-04T00:00:00Z"),
    ];
    expect(latestDocument(documents, "passport", 0)?.id).toBe("new");
    expect(latestDocument(documents, "passport", 1)?.id).toBe("other");
  });

  it("shows a pending row only when it is the only one", () => {
    const only = [upload("stuck", "passport", 0, "pending", "2026-09-03T00:00:00Z")];
    expect(latestDocument(only, "passport", 0)?.id).toBe("stuck");
    expect(latestDocument(only, "proof_of_address", 0)).toBeNull();
  });
});

describe("reportParagraphs", () => {
  it("splits on blank lines and keeps single breaks", () => {
    expect(reportParagraphs("One\nstill one\r\n\r\nTwo\n\n\n\nThree\n")).toEqual(["One\nstill one", "Two", "Three"]);
  });

  it("gives nothing for an empty report", () => {
    expect(reportParagraphs(null)).toEqual([]);
    expect(reportParagraphs("  \n ")).toEqual([]);
  });
});

describe("hasAnswers", () => {
  it("is false for a gallery order's empty snapshot", () => {
    expect(hasAnswers({})).toBe(false);
    expect(hasAnswers(null)).toBe(false);
    expect(hasAnswers({ residence: "US" })).toBe(true);
  });
});

describe("isInProgress", () => {
  const now = new Date("2026-09-12T12:00:00Z");
  const paid = "2026-09-01T00:00:00Z";

  it("is false for an unpaid order whatever its dates", () => {
    expect(isInProgress({ paid_at: null, completed_at: null }, now)).toBe(false);
    expect(isInProgress({ paid_at: null, completed_at: "2026-09-11T00:00:00Z" }, now)).toBe(false);
  });

  it("is true for a paid order that is not complete", () => {
    expect(isInProgress({ paid_at: paid, completed_at: null }, now)).toBe(true);
  });

  it("keeps a completed order for seven days, then drops it", () => {
    expect(isInProgress({ paid_at: paid, completed_at: "2026-09-11T10:00:00Z" }, now)).toBe(true);
    expect(isInProgress({ paid_at: paid, completed_at: "2026-09-05T12:00:01Z" }, now)).toBe(true);
    expect(isInProgress({ paid_at: paid, completed_at: "2026-09-05T12:00:00Z" }, now)).toBe(false);
    expect(isInProgress({ paid_at: paid, completed_at: "2026-08-01T00:00:00Z" }, now)).toBe(false);
  });

  it("keeps an order completed on 11 September until the 18th", () => {
    const order = { paid_at: paid, completed_at: "2026-09-11T15:30:00Z" };
    expect(isRecentlyCompleted(order, new Date("2026-09-17T23:00:00Z"))).toBe(true);
    expect(isRecentlyCompleted(order, new Date("2026-09-18T16:00:00Z"))).toBe(false);
  });

  it("ignores a completed_at in the future or unreadable", () => {
    expect(isRecentlyCompleted({ completed_at: "2026-09-13T00:00:00Z" }, now)).toBe(false);
    expect(isRecentlyCompleted({ completed_at: "not a date" }, now)).toBe(false);
  });
});

describe("progressFraction", () => {
  const stages = [
    { key: "nif_ready", position: 4 },
    { key: "awaiting_payment", position: 1 },
    { key: "documents", position: 2 },
    { key: "awaiting_financas", position: 3 },
  ];

  it("counts the stages passed, whatever the input order", () => {
    expect(progressFraction(stages, "awaiting_payment", false)).toEqual({ done: 0, total: 4 });
    expect(progressFraction(stages, "documents", false)).toEqual({ done: 1, total: 4 });
    expect(progressFraction(stages, "nif_ready", false)).toEqual({ done: 3, total: 4 });
  });

  it("is full once the order is complete", () => {
    expect(progressFraction(stages, "nif_ready", true)).toEqual({ done: 4, total: 4 });
  });

  it("treats an unknown stage as the first one and no stages as nothing", () => {
    expect(progressFraction(stages, "gone", false)).toEqual({ done: 0, total: 4 });
    expect(progressFraction([], "documents", false)).toEqual({ done: 0, total: 0 });
  });
});

describe("documentCounts", () => {
  const docs = [doc("passport", 1), doc("proof_of_address", 2, false), { ...doc("extra", 3), required: false }];
  const noDeeds = { required: 0, received: 0 };

  it("counts one slot per required document and applicant", () => {
    expect(documentCounts(docs, [], 1)).toEqual({ required: 2, received: 0, rejected: 0, deeds: noDeeds });
    expect(documentCounts(docs, [], 2)).toEqual({ required: 3, received: 0, rejected: 0, deeds: noDeeds });
  });

  it("counts uploaded and approved as received, rejected apart, pending as nothing", () => {
    const documents = [
      upload("a", "passport", 0, "approved", "2026-09-01T00:00:00Z"),
      upload("b", "passport", 1, "uploaded", "2026-09-01T00:00:00Z"),
      upload("c", "proof_of_address", 0, "rejected", "2026-09-02T00:00:00Z", "Blurry"),
      upload("d", "extra", 0, "approved", "2026-09-02T00:00:00Z"),
    ];
    expect(documentCounts(docs, documents, 2)).toEqual({ required: 3, received: 2, rejected: 1, deeds: noDeeds });
    const stuck = [upload("e", "passport", 0, "pending", "2026-09-03T00:00:00Z")];
    expect(documentCounts(docs, stuck, 1)).toEqual({ required: 2, received: 0, rejected: 0, deeds: noDeeds });
  });

  it("counts deed slots inside the required ones and apart", () => {
    const withDeeds = [...docs, doc("poa_nif", 4, true, "poa_nif"), doc("poa_bank", 5, true, "poa_bank")];
    expect(documentCounts(withDeeds, [], 1)).toEqual({ required: 4, received: 0, rejected: 0, deeds: { required: 2, received: 0 } });
    expect(documentCounts(withDeeds, [], 2)).toEqual({ required: 7, received: 0, rejected: 0, deeds: { required: 4, received: 0 } });

    const documents = [
      upload("a", "poa_nif", 0, "uploaded", "2026-09-01T00:00:00Z"),
      upload("b", "poa_bank", 1, "approved", "2026-09-01T00:00:00Z"),
      upload("c", "poa_bank", 0, "rejected", "2026-09-02T00:00:00Z", "Unsigned"),
      upload("d", "passport", 0, "approved", "2026-09-02T00:00:00Z"),
    ];
    expect(documentCounts(withDeeds, documents, 2)).toEqual({
      required: 7,
      received: 3,
      rejected: 1,
      deeds: { required: 4, received: 2 },
    });
  });

  it("leaves an optional deed slot out, like any optional document", () => {
    const optionalDeed = [doc("passport", 1), { ...doc("poa_nif", 2, true, "poa_nif"), required: false }];
    expect(documentCounts(optionalDeed, [], 1).deeds).toEqual(noDeeds);
  });
});

describe("nextStep", () => {
  const docs = { required: 3, received: 3, rejected: 0, deeds: { required: 0, received: 0 } };

  it("ranks payment, rejected files, missing uploads, then what came back", () => {
    expect(nextStep({ paid: false, completed: false, docs, deliverables: 0 })).toBe("Pay to start");
    expect(nextStep({ paid: true, completed: false, docs: { ...docs, rejected: 1 }, deliverables: 0 })).toBe("Send 1 file again");
    expect(nextStep({ paid: true, completed: false, docs: { ...docs, received: 1 }, deliverables: 0 })).toBe("Upload 2 documents");
    expect(nextStep({ paid: true, completed: false, docs: { ...docs, received: 2 }, deliverables: 0 })).toBe("Upload 1 document");
    expect(nextStep({ paid: true, completed: false, docs, deliverables: 0 })).toBe("Nothing needed from you right now");
    expect(nextStep({ paid: true, completed: true, docs, deliverables: 2 })).toBe("Your documents are ready to download");
    expect(nextStep({ paid: true, completed: true, docs, deliverables: 0 })).toBe("All done");
  });

  it("asks to sign and upload when only deeds are missing", () => {
    const oneDeed = { required: 3, received: 2, rejected: 0, deeds: { required: 1, received: 0 } };
    expect(nextStep({ paid: true, completed: false, docs: oneDeed, deliverables: 0 })).toBe("Sign and upload 1 document");

    const twoDeeds = { required: 4, received: 2, rejected: 0, deeds: { required: 2, received: 0 } };
    expect(nextStep({ paid: true, completed: false, docs: twoDeeds, deliverables: 0 })).toBe("Sign and upload 2 documents");
  });

  it("counts everything as uploads when ordinary documents are missing too", () => {
    const mixed = { required: 4, received: 1, rejected: 0, deeds: { required: 2, received: 0 } };
    expect(nextStep({ paid: true, completed: false, docs: mixed, deliverables: 0 })).toBe("Upload 3 documents");

    const deedsDone = { required: 4, received: 2, rejected: 0, deeds: { required: 2, received: 2 } };
    expect(nextStep({ paid: true, completed: false, docs: deedsDone, deliverables: 0 })).toBe("Upload 2 documents");
  });

  it("puts a rejected deed before the ones still to sign", () => {
    const rejected = { required: 4, received: 1, rejected: 1, deeds: { required: 2, received: 0 } };
    expect(nextStep({ paid: true, completed: false, docs: rejected, deliverables: 0 })).toBe("Send 1 file again");
  });

  it("does not ask a completed order for missing uploads", () => {
    expect(nextStep({ paid: true, completed: true, docs: { ...docs, received: 0 }, deliverables: 1 })).toBe(
      "Your documents are ready to download",
    );
  });
});
