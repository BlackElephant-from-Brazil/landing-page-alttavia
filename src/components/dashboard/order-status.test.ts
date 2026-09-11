import { describe, expect, it } from "vitest";

import type { ServiceDocRow, UserDocumentRow, UserServiceNoteRow } from "@/lib/db/types";

import {
  hasAnswers,
  latestDocument,
  orderStatus,
  rejectedSlots,
  reportParagraphs,
  slotName,
  splitNotes,
} from "./order-status";

function doc(id: string, position: number, perApplicant = true): ServiceDocRow {
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

function note(id: string, createdAt: string, resolved: string | null, audience: "client" | "internal" = "client"): UserServiceNoteRow {
  return { id, user_service_id: "order", author_id: null, audience, body: id, resolved_at: resolved, created_at: createdAt };
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

describe("splitNotes", () => {
  it("separates open from resolved, newest first, and skips internal notes", () => {
    const notes = [
      note("old-open", "2026-09-01T00:00:00Z", null),
      note("resolved", "2026-09-02T00:00:00Z", "2026-09-03T00:00:00Z"),
      note("new-open", "2026-09-04T00:00:00Z", null),
      note("internal", "2026-09-05T00:00:00Z", null, "internal"),
    ];
    const { open, resolved } = splitNotes(notes);
    expect(open.map((n) => n.id)).toEqual(["new-open", "old-open"]);
    expect(resolved.map((n) => n.id)).toEqual(["resolved"]);
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
