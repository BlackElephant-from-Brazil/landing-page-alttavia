import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceDocRow, UserDocumentRow, UserServiceRow } from "@/lib/db/types";

/**
 * POST /api/documents/upload-url against a fake database, with stand ins for
 * the session and the bucket. What is under test is which slot takes a new
 * file: the row of an upload that never finished is taken over rather than
 * replaced (so one slot can never hold a second object nobody points at), a
 * file waiting for review can be replaced, and nothing at all is accepted
 * once the order has left the documents stage or the firm has approved the
 * file.
 */

type Row = Record<string, unknown>;

const { tables, steps, flags, session, presignUpload, deleteObject } = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  steps: [] as string[],
  /** `lostRace`: the conditional update matches nothing, as when the row changed underneath. */
  flags: { lostRace: false },
  session: { user: null as { id: string; email: string } | null },
  presignUpload: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock("@/lib/supabase/user", () => ({ getUser: async () => session.user }));
vi.mock("@/lib/r2/client", () => ({ presignUpload, deleteObject, headObjectSize: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => {
    throw new Error("headers() was called outside a request scope");
  },
}));

let inserted = 0;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const filters: [string, unknown][] = [];
      let op: "select" | "insert" | "delete" | "update" = "select";
      let values: Row = {};
      const rows = () => (tables[table] ??= []);
      const matching = () => rows().filter((row) => filters.every(([c, v]) => row[c] === v));
      const run = () => {
        if (op === "insert") {
          const row: Row = { id: `new-${++inserted}`, created_at: new Date().toISOString(), ...values };
          rows().push(row);
          steps.push(`insert ${row.storage_key as string}`);
          return { data: [{ ...row }], error: null };
        }
        if (op === "update") {
          if (flags.lostRace) return { data: [], error: null };
          const hit = matching();
          for (const row of hit) Object.assign(row, values);
          for (const row of hit) steps.push(`update ${row.id as string}`);
          return { data: hit.map((r) => ({ ...r })), error: null };
        }
        if (op === "delete") {
          const hit = matching();
          tables[table] = rows().filter((row) => !hit.includes(row));
          steps.push(`row ${hit.map((r) => r.id).join(",")}`);
          return { data: hit.map((r) => ({ ...r })), error: null };
        }
        return { data: matching().map((r) => ({ ...r })), error: null };
      };
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        insert(next: Row) {
          op = "insert";
          values = next;
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
        maybeSingle() {
          return Promise.resolve({ data: run().data?.[0] ?? null, error: null });
        },
        single() {
          const data = run().data?.[0] ?? null;
          return Promise.resolve({ data, error: data ? null : { message: "no row" } });
        },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return query;
    },
  }),
}));

import { POST } from "./route";

const OWNER = { id: "11111111-1111-4111-8111-111111111111", email: "client@example.com" };
const STRANGER = { id: "22222222-2222-4222-8222-222222222222", email: "other@example.com" };
const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const SERVICE_ID = "44444444-4444-4444-8444-444444444444";
const DOC_ID = "66666666-6666-4666-8666-666666666666";
const EXISTING = "77777777-7777-4777-8777-777777777777";
const KEY = `orders/${ORDER_ID}/passport/0/old.png`;
const BASE = "http://localhost:3000";

const order: UserServiceRow = {
  id: ORDER_ID,
  user_id: OWNER.id,
  service_id: SERVICE_ID,
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

const doc: ServiceDocRow = {
  id: DOC_ID,
  service_id: SERVICE_ID,
  key: "passport",
  label: "Passport",
  note: null,
  accepted_mime: ["image/png", "application/pdf"],
  max_bytes: 10_000_000,
  per_applicant: false,
  required: true,
  position: 1,
  template: null,
};

function existing(status: UserDocumentRow["status"]): Row {
  return {
    id: EXISTING,
    user_service_id: ORDER_ID,
    service_doc_id: DOC_ID,
    applicant_index: 0,
    storage_key: KEY,
    file_name: "old.png",
    mime_type: "image/png",
    size_bytes: 1000,
    status,
    rejection_reason: null,
    uploaded_at: status === "pending" ? null : "2026-09-21T10:00:00.000Z",
    reviewed_at: null,
    reviewed_by: null,
    created_at: "2026-09-21T10:00:00.000Z",
    updated_at: "2026-09-21T10:00:00.000Z",
  };
}

function seed(documents: Row[], stageKey = "documents") {
  tables.user_services = [{ ...order, stage_key: stageKey }];
  tables.service_docs = [{ ...doc }];
  tables.user_documents = documents;
}

function ask(mimeType = "image/png", fileName = "proof of address.png") {
  return POST(
    new Request(`${BASE}/api/documents/upload-url`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({
        userServiceId: ORDER_ID,
        serviceDocId: DOC_ID,
        applicantIndex: 0,
        fileName,
        mimeType,
        sizeBytes: 1_150_000,
      }),
    }),
  );
}

async function errorOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: string }).error;
}

function ids(): unknown[] {
  return (tables.user_documents ?? []).map((row) => row.id);
}

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  steps.length = 0;
  inserted = 0;
  flags.lostRace = false;
  session.user = OWNER;
  presignUpload.mockReset();
  presignUpload.mockResolvedValue({ url: "https://bucket.example/put", expiresIn: 300 });
  deleteObject.mockReset();
  deleteObject.mockImplementation(async (key: string) => {
    steps.push(`object ${key}`);
  });
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logged.mockRestore();
});

describe("POST /api/documents/upload-url", () => {
  it("hands out a URL for an empty slot", async () => {
    seed([]);

    const response = await ask();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ url: "https://bucket.example/put" });
    expect(tables.user_documents).toHaveLength(1);
    expect(tables.user_documents[0].status).toBe("pending");
  });

  it("takes over the row of an upload that never finished, keeping its key", async () => {
    seed([existing("pending")]);

    const response = await ask();

    // One row and one key per slot: a second row would mean a second object
    // in the bucket with nothing pointing at it.
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ documentId: EXISTING, key: KEY });
    expect(steps).toEqual([`update ${EXISTING}`]);
    expect(ids()).toEqual([EXISTING]);
    expect(deleteObject).not.toHaveBeenCalled();
    expect(tables.user_documents[0]).toMatchObject({ file_name: "proof of address.png", status: "pending" });
  });

  it("moves the key when the file type changed, and removes what the old key held", async () => {
    seed([existing("pending")]);

    const response = await ask("application/pdf", "proof of address.pdf");

    const body = (await response.json()) as { documentId: string; key: string };
    expect(response.status).toBe(200);
    expect(body.documentId).toBe(EXISTING);
    expect(body.key).toMatch(/\.pdf$/);
    expect(steps).toEqual([`update ${EXISTING}`, `object ${KEY}`]);
    expect(ids()).toEqual([EXISTING]);
  });

  it("keeps the row when the old object cannot be removed", async () => {
    seed([existing("pending")]);
    deleteObject.mockRejectedValueOnce(new Error("no credentials"));

    const response = await ask("application/pdf", "proof of address.pdf");

    expect(response.status).toBe(200);
    expect(ids()).toEqual([EXISTING]);
  });

  it("refuses when the unfinished upload changed underneath, and writes nothing", async () => {
    seed([existing("pending")]);
    flags.lostRace = true;

    const response = await ask();

    expect(response.status).toBe(409);
    expect(await errorOf(response)).toBe("This slot changed a moment ago. Refresh the page and try again.");
    expect(presignUpload).not.toHaveBeenCalled();
    expect(ids()).toEqual([EXISTING]);
  });

  it("takes a replacement for a file waiting for review, and leaves it in place for now", async () => {
    seed([existing("uploaded")]);

    const response = await ask();

    expect(response.status).toBe(200);
    expect(ids()).toEqual([EXISTING, "new-1"]);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("refuses a replacement once the order has moved past the documents stage", async () => {
    seed([existing("uploaded")], "processing");

    const response = await ask();

    expect(response.status).toBe(409);
    expect(await errorOf(response)).toBe("This file can no longer be changed.");
    expect(ids()).toEqual([EXISTING]);
  });

  it("refuses an empty slot once the order has moved past the documents stage", async () => {
    seed([], "nif_ready");

    const response = await ask();

    expect(response.status).toBe(409);
    expect(await errorOf(response)).toBe("This order has moved on. Write to us if you still need to send a file.");
    expect(presignUpload).not.toHaveBeenCalled();
    expect(ids()).toEqual([]);
  });

  it("refuses a rejected slot on a completed order", async () => {
    seed([existing("rejected")], "account_open");

    const response = await ask();

    expect(response.status).toBe(409);
    expect(await errorOf(response)).toBe("This file can no longer be changed.");
    expect(ids()).toEqual([EXISTING]);
  });

  it("refuses a new file for an approved slot", async () => {
    seed([existing("approved")]);

    const response = await ask();

    expect(response.status).toBe(409);
    expect(await errorOf(response)).toBe("This file was approved and cannot be changed.");
  });

  it("takes a new file for a rejected slot", async () => {
    seed([existing("rejected")]);

    const response = await ask();

    expect(response.status).toBe(200);
    expect(ids()).toEqual([EXISTING, "new-1"]);
  });

  it("refuses a stranger's order and writes nothing", async () => {
    session.user = STRANGER;
    seed([]);

    const response = await ask();

    expect(response.status).toBe(403);
    expect(await errorOf(response)).toBe("This order is not yours.");
    expect(ids()).toEqual([]);
  });
});
