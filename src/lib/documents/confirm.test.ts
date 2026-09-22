import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/lib/db/queries";
import type { UserDocumentRow, UserServiceRow } from "@/lib/db/types";

/**
 * `confirmDocumentUpload` against a fake database that enforces the one rule
 * this module has to respect: `user_documents_live_slot_idx`
 * (0004_hardening.sql) allows a single `uploaded` or `approved` row per
 * order, document and applicant. The fake answers 23505 the way Postgres
 * does, so the test fails again if the drop ever moves back after the flip,
 * which is what made every replacement of a file waiting for review answer
 * 500 until 2026-09-22.
 *
 * `steps` records what happened in order: a row removed, an object removed
 * from the bucket, the row flipped. The order is the point: the row goes
 * first, and only while it is still `uploaded`, so a file the firm approves
 * in the meantime is refused rather than destroyed.
 */

type Row = Record<string, unknown>;

const { tables, steps, headObjectSize, deleteObject, notifyDocumentsReady } = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  steps: [] as string[],
  headObjectSize: vi.fn(),
  deleteObject: vi.fn(),
  notifyDocumentsReady: vi.fn(),
}));

vi.mock("@/lib/r2/client", () => ({ headObjectSize, deleteObject }));
vi.mock("@/lib/orders/notify", () => ({ notifyDocumentsReady }));

import {
  APPROVED_LOCKED,
  DocumentError,
  REVIEW_LOCKED,
  SLOT_FILLED,
  confirmDocumentUpload,
  deleteOwnDocument,
} from "./confirm";

const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const DOC_ID = "66666666-6666-4666-8666-666666666666";
const LIVE = new Set(["uploaded", "approved"]);

/** The live slot index: at most one uploaded or approved row per slot. */
function violatesLiveSlot(rows: Row[]): boolean {
  const seen = new Set<string>();
  for (const row of rows) {
    if (!LIVE.has(String(row.status))) continue;
    const slot = `${row.user_service_id}|${row.service_doc_id}|${row.applicant_index}`;
    if (seen.has(slot)) return true;
    seen.add(slot);
  }
  return false;
}

function fakeDb(): Db {
  return {
    from(table: string) {
      const filters: [string, unknown][] = [];
      let op: "select" | "delete" | "update" = "select";
      let values: Row = {};
      const rows = () => (tables[table] ??= []);
      const matching = () => rows().filter((row) => filters.every(([column, value]) => row[column] === value));
      const run = () => {
        if (op === "delete") {
          const hit = matching();
          tables[table] = rows().filter((row) => !hit.includes(row));
          for (const row of hit) steps.push(`row ${row.id}`);
          return { data: hit.map((row) => ({ ...row })), error: null };
        }
        if (op === "update") {
          const hit = matching();
          const before = hit.map((row) => ({ ...row }));
          for (const row of hit) Object.assign(row, values);
          if (violatesLiveSlot(rows())) {
            hit.forEach((row, index) => Object.assign(row, before[index]));
            return {
              data: null,
              error: {
                code: "23505",
                message: 'duplicate key value violates unique constraint "user_documents_live_slot_idx"',
              },
            };
          }
          for (const row of hit) steps.push(`flip ${row.id} ${row.status}`);
          return { data: hit.map((row) => ({ ...row })), error: null };
        }
        return { data: matching().map((row) => ({ ...row })), error: null };
      };
      const query = {
        select() {
          return query;
        },
        update(next: Row) {
          op = "update";
          values = next;
          return query;
        },
        delete() {
          op = "delete";
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return query;
        },
        single() {
          const answer = run();
          return Promise.resolve({ data: answer.data?.[0] ?? null, error: answer.error });
        },
        maybeSingle() {
          const answer = run();
          return Promise.resolve({ data: answer.data?.[0] ?? null, error: answer.error });
        },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return query;
    },
  } as unknown as Db;
}

/**
 * The same fake, except that the flip finds the slot already live and
 * Postgres answers 23505, which is what two uploads confirmed at the same
 * moment produce. Only `update` is replaced; every read still comes from the
 * tables.
 */
function slotTakenDb(): Db {
  const conflict = {
    eq: () => conflict,
    select: () => conflict,
    single: async () => ({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "user_documents_live_slot_idx"',
      },
    }),
  };
  const base = fakeDb();
  return {
    from(table: string) {
      const query = base.from(table) as unknown as Record<string, unknown>;
      if (table !== "user_documents") return query;
      return { ...query, update: () => conflict };
    },
  } as unknown as Db;
}

const order: UserServiceRow = {
  id: ORDER_ID,
  user_id: "11111111-1111-4111-8111-111111111111",
  service_id: "44444444-4444-4444-8444-444444444444",
  submission_id: null,
  answers_snapshot: {},
  joint: false,
  applicants: 1,
  total_cents: 14900,
  currency: "eur",
  stage_key: "documents",
  stripe_checkout_session_id: "cs_test_1",
  stripe_payment_intent_id: "pi_test_1",
  paid_at: "2026-09-21T09:00:00.000Z",
  completed_at: null,
  report: null,
  created_at: "2026-09-21T08:55:00.000Z",
  updated_at: "2026-09-21T09:00:00.000Z",
};

function file(id: string, status: UserDocumentRow["status"], createdAt: string): UserDocumentRow {
  return {
    id,
    user_service_id: ORDER_ID,
    service_doc_id: DOC_ID,
    applicant_index: 0,
    storage_key: `orders/${ORDER_ID}/address/0/${id}.png`,
    file_name: "proof of address.png",
    mime_type: "image/png",
    size_bytes: 1_150_000,
    status,
    rejection_reason: null,
    uploaded_at: status === "pending" ? null : createdAt,
    reviewed_at: null,
    reviewed_by: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

const OLD = file("aaaa1111-1111-4111-8111-111111111111", "uploaded", "2026-09-21T10:00:00.000Z");
const NEW = file("bbbb2222-2222-4222-8222-222222222222", "pending", "2026-09-21T11:00:00.000Z");

function seed(rows: UserDocumentRow[]) {
  tables.user_documents = rows.map((row) => ({ ...row }) as Row);
}

function confirm(document: UserDocumentRow = NEW) {
  return confirmDocumentUpload({ db: fakeDb(), document, order, origin: null });
}

function stored(id: string): Row | undefined {
  return (tables.user_documents ?? []).find((row) => row.id === id);
}

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  steps.length = 0;
  headObjectSize.mockReset();
  headObjectSize.mockResolvedValue(NEW.size_bytes);
  deleteObject.mockReset();
  deleteObject.mockImplementation(async (key: string) => {
    steps.push(`object ${key}`);
  });
  notifyDocumentsReady.mockReset();
  notifyDocumentsReady.mockResolvedValue(undefined);
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logged.mockRestore();
});

describe("confirmDocumentUpload", () => {
  it("finishes a first upload and tells the team", async () => {
    seed([NEW]);

    const confirmed = await confirm();

    expect(confirmed.status).toBe("uploaded");
    expect(confirmed.uploaded_at).not.toBeNull();
    expect(notifyDocumentsReady).toHaveBeenCalledTimes(1);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("replaces a file that is still waiting for review, dropping its row before the flip", async () => {
    seed([OLD, NEW]);

    const confirmed = await confirm();

    expect(confirmed.status).toBe("uploaded");
    expect(steps).toEqual([`row ${OLD.id}`, `object ${OLD.storage_key}`, `flip ${NEW.id} uploaded`]);
    expect(stored(OLD.id)).toBeUndefined();
    expect(stored(NEW.id)?.status).toBe("uploaded");
  });

  it("says nothing to the team when a file waiting for review is only swapped", async () => {
    seed([OLD, NEW]);

    await confirm();

    // The slot was filled before and it is filled now: the set never moved
    // from incomplete to complete, so the firm hears nothing.
    expect(notifyDocumentsReady).not.toHaveBeenCalled();
  });

  it("refuses when the firm approves the file being replaced a moment before the drop", async () => {
    // `status` reads `uploaded` once, for the sibling read, and `approved`
    // from then on: the review landed between the read and the delete.
    const approvedMeanwhile = { ...(file(OLD.id, "uploaded", OLD.created_at) as unknown as Row) };
    let reads = 0;
    Object.defineProperty(approvedMeanwhile, "status", {
      enumerable: true,
      get: () => (++reads === 1 ? "uploaded" : "approved"),
    });
    tables.user_documents = [approvedMeanwhile, { ...NEW } as Row];

    await expect(confirm()).rejects.toMatchObject({ name: "DocumentError", status: 409, message: APPROVED_LOCKED });
    expect(stored(OLD.id)).toBeDefined();
    expect(deleteObject).not.toHaveBeenCalled();
    expect(stored(NEW.id)?.status).toBe("pending");
    expect(notifyDocumentsReady).not.toHaveBeenCalled();
  });

  it("answers a refusal, not a failure, when another file reached the slot first", async () => {
    seed([NEW]);

    await expect(confirmDocumentUpload({ db: slotTakenDb(), document: NEW, order, origin: null })).rejects.toMatchObject(
      { name: "DocumentError", status: 409, message: SLOT_FILLED },
    );
    expect(notifyDocumentsReady).not.toHaveBeenCalled();
  });

  it("keeps a rejected file as the history of the review, and tells the team the set is complete again", async () => {
    const rejected = file("cccc3333-3333-4333-8333-333333333333", "rejected", "2026-09-21T09:30:00.000Z");
    seed([rejected, NEW]);

    await confirm();

    expect(stored(rejected.id)?.status).toBe("rejected");
    expect(deleteObject).not.toHaveBeenCalled();
    expect(notifyDocumentsReady).toHaveBeenCalledTimes(1);
  });

  it("refuses once the firm has approved a file for the slot, and writes nothing", async () => {
    const approved = file("dddd4444-4444-4444-8444-444444444444", "approved", "2026-09-21T10:30:00.000Z");
    seed([approved, NEW]);

    await expect(confirm()).rejects.toMatchObject({ name: "DocumentError", status: 409, message: APPROVED_LOCKED });
    expect(stored(approved.id)?.status).toBe("approved");
    expect(stored(NEW.id)?.status).toBe("pending");
    expect(deleteObject).not.toHaveBeenCalled();
    expect(notifyDocumentsReady).not.toHaveBeenCalled();
  });

  it("answers a row that is already uploaded without writing or sending", async () => {
    seed([OLD]);

    const confirmed = await confirm(OLD);

    expect(confirmed).toBe(OLD);
    expect(steps).toEqual([]);
    expect(notifyDocumentsReady).not.toHaveBeenCalled();
  });

  it("refuses a row that has already been reviewed", async () => {
    const rejected = file(NEW.id, "rejected", NEW.created_at);
    seed([rejected]);

    await expect(confirm(rejected)).rejects.toBeInstanceOf(DocumentError);
    expect(notifyDocumentsReady).not.toHaveBeenCalled();
  });

  it("keeps the replaced file when the bucket does not hold the new one", async () => {
    seed([OLD, NEW]);
    headObjectSize.mockResolvedValue(null);

    await expect(confirm()).rejects.toMatchObject({ status: 422 });
    expect(stored(OLD.id)?.status).toBe("uploaded");
    expect(stored(NEW.id)?.status).toBe("pending");
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("drops the row even when its object cannot be removed", async () => {
    seed([OLD, NEW]);
    deleteObject.mockRejectedValue(new Error("bucket unreachable"));

    const confirmed = await confirm();

    expect(confirmed.status).toBe("uploaded");
    expect(stored(OLD.id)).toBeUndefined();
    expect(logged).toHaveBeenCalled();
  });
});

describe("deleteOwnDocument", () => {
  it("removes the row first and the object only once a row has gone", async () => {
    seed([OLD]);

    await deleteOwnDocument(fakeDb(), OLD);

    expect(steps).toEqual([`row ${OLD.id}`, `object ${OLD.storage_key}`]);
    expect(stored(OLD.id)).toBeUndefined();
  });

  it("refuses, and keeps the file, when the firm reviewed it a moment ago", async () => {
    // The row the route read as `uploaded` is `approved` by the time the
    // delete runs, so the conditional delete matches nothing.
    seed([{ ...OLD, status: "approved" }]);

    await expect(deleteOwnDocument(fakeDb(), OLD)).rejects.toMatchObject({
      name: "DocumentError",
      status: 409,
      message: APPROVED_LOCKED,
    });
    expect(stored(OLD.id)?.status).toBe("approved");
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("refuses with the plain line when the row went altogether", async () => {
    seed([]);

    await expect(deleteOwnDocument(fakeDb(), OLD)).rejects.toMatchObject({ status: 409, message: REVIEW_LOCKED });
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("refuses a key outside the order's folder before the bucket is touched", async () => {
    const stray = { ...OLD, storage_key: `deliverables/${ORDER_ID}/file.png` };
    seed([stray]);

    await expect(deleteOwnDocument(fakeDb(), stray)).rejects.toThrow(/outside its order/);
    expect(deleteObject).not.toHaveBeenCalled();
    expect(stored(OLD.id)).toBeDefined();
  });
});
