import { describe, expect, it } from "vitest";

import { buildDocumentSlots, unapprovedRequired, unapprovedRequiredFor, type SlotDoc, type SlotUpload } from "./required-docs";

/**
 * The rule the modal draws and the stage route enforces. Both sides call
 * these functions, so a change here changes both at once.
 */

function doc(id: string, position: number, extra: Partial<SlotDoc> = {}): SlotDoc {
  return { id, position, required: true, per_applicant: false, ...extra };
}

function upload(docId: string, status: SlotUpload["status"], created_at: string, applicant: 0 | 1 = 0): SlotUpload {
  return { service_doc_id: docId, applicant_index: applicant, status, created_at };
}

describe("buildDocumentSlots", () => {
  it("orders slots by position and gives a per applicant slot to each person", () => {
    const docs = [doc("b", 2, { per_applicant: true }), doc("a", 1)];

    const slots = buildDocumentSlots(docs, [], 2);

    expect(slots.map((s) => [s.doc.id, s.applicantIndex])).toEqual([
      ["a", 0],
      ["b", 0],
      ["b", 1],
    ]);
  });

  it("gives one slot per document on a single applicant order", () => {
    const slots = buildDocumentSlots([doc("a", 1, { per_applicant: true })], [], 1);

    expect(slots).toHaveLength(1);
    expect(slots[0].applicantIndex).toBe(0);
  });

  it("keeps the newest upload as the latest and the earlier ones newest first", () => {
    const docs = [doc("a", 1)];
    const documents = [
      upload("a", "rejected", "2026-09-01T10:00:00.000Z"),
      upload("a", "uploaded", "2026-09-03T10:00:00.000Z"),
      upload("a", "rejected", "2026-09-02T10:00:00.000Z"),
    ];

    const [slot] = buildDocumentSlots(docs, documents, 1);

    expect(slot.latest?.created_at).toBe("2026-09-03T10:00:00.000Z");
    expect(slot.history.map((h) => h.created_at)).toEqual(["2026-09-02T10:00:00.000Z", "2026-09-01T10:00:00.000Z"]);
  });

  it("leaves the latest on the reviewed file when a newer upload never finished", () => {
    const docs = [doc("a", 1)];
    const documents = [
      upload("a", "uploaded", "2026-09-03T10:00:00.000Z"),
      upload("a", "pending", "2026-09-04T10:00:00.000Z"),
    ];

    const [slot] = buildDocumentSlots(docs, documents, 1);

    expect(slot.latest?.status).toBe("uploaded");
    expect(slot.history.map((h) => h.status)).toEqual(["pending"]);
  });

  it("shows an unfinished upload only while the slot holds nothing else", () => {
    const [slot] = buildDocumentSlots([doc("a", 1)], [upload("a", "pending", "2026-09-04T10:00:00.000Z")], 1);

    expect(slot.latest?.status).toBe("pending");
    expect(slot.history).toEqual([]);
  });

  it("keeps each applicant's uploads on their own slot", () => {
    const docs = [doc("a", 1, { per_applicant: true })];
    const documents = [upload("a", "approved", "2026-09-01T10:00:00.000Z", 0)];

    const slots = buildDocumentSlots(docs, documents, 2);

    expect(slots[0].latest?.status).toBe("approved");
    expect(slots[1].latest).toBeNull();
  });
});

describe("unapprovedRequired", () => {
  it("counts a required slot with nothing uploaded", () => {
    expect(unapprovedRequiredFor([doc("a", 1)], [], 1)).toBe(1);
  });

  it("counts a required slot waiting for a review or rejected, and ignores optional ones", () => {
    const docs = [doc("a", 1), doc("b", 2), doc("c", 3, { required: false })];
    const documents = [
      upload("a", "uploaded", "2026-09-01T10:00:00.000Z"),
      upload("b", "rejected", "2026-09-01T10:00:00.000Z"),
      upload("c", "uploaded", "2026-09-01T10:00:00.000Z"),
    ];

    expect(unapprovedRequiredFor(docs, documents, 1)).toBe(2);
  });

  it("is zero once every required slot has an approved file", () => {
    const docs = [doc("a", 1), doc("b", 2, { required: false })];
    const documents = [upload("a", "approved", "2026-09-02T10:00:00.000Z")];

    expect(unapprovedRequiredFor(docs, documents, 1)).toBe(0);
  });

  it("counts a slot again when an approved file was replaced by a newer upload", () => {
    const docs = [doc("a", 1)];
    const documents = [
      upload("a", "approved", "2026-09-01T10:00:00.000Z"),
      upload("a", "uploaded", "2026-09-04T10:00:00.000Z"),
    ];

    expect(unapprovedRequiredFor(docs, documents, 1)).toBe(1);
  });

  it("does not count an approved slot again because an upload never finished", () => {
    const docs = [doc("a", 1)];
    const documents = [
      upload("a", "approved", "2026-09-01T10:00:00.000Z"),
      upload("a", "pending", "2026-09-05T10:00:00.000Z"),
    ];

    expect(unapprovedRequiredFor(docs, documents, 1)).toBe(0);
  });

  it("counts the second applicant's missing file on a couple order", () => {
    const docs = [doc("a", 1, { per_applicant: true })];
    const documents = [upload("a", "approved", "2026-09-01T10:00:00.000Z", 0)];

    expect(unapprovedRequiredFor(docs, documents, 2)).toBe(1);
    expect(unapprovedRequiredFor(docs, documents, 1)).toBe(0);
  });

  it("is zero for a service that asks for nothing", () => {
    expect(unapprovedRequired(buildDocumentSlots([], [], 1))).toBe(0);
  });
});
