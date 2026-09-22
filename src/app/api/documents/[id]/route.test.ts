import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UserDocumentRow, UserServiceRow } from "@/lib/db/types";

/**
 * DELETE /api/documents/[id] against a fake database, with stand ins for the
 * session and the bucket. `steps` records the row removal and the bucket
 * removal in the order they happened, which is the order that matters: the
 * row goes first and carries the status this handler read, so a file the firm
 * approves in the meantime is refused instead of being destroyed, and a
 * failed delete can never leave a row pointing at an object that is gone.
 */

type Row = Record<string, unknown>;

const { tables, steps, session, deleteObject } = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  steps: [] as string[],
  session: { user: null as { id: string; email: string } | null },
  deleteObject: vi.fn(),
}));

vi.mock("@/lib/supabase/user", () => ({ getUser: async () => session.user }));
vi.mock("@/lib/r2/client", () => ({ deleteObject, headObjectSize: vi.fn(), presignDownload: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => {
    throw new Error("headers() was called outside a request scope");
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const filters: [string, unknown][] = [];
      let op: "select" | "delete" = "select";
      const rows = () => (tables[table] ??= []);
      const matching = () => rows().filter((row) => filters.every(([c, v]) => row[c] === v));
      const run = () => {
        if (op === "delete") {
          const hit = matching();
          tables[table] = rows().filter((row) => !hit.includes(row));
          if (hit.length > 0) steps.push(`row ${hit.map((r) => r.id).join(",")}`);
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
        delete() {
          op = "delete";
          return query;
        },
        maybeSingle() {
          return Promise.resolve({ data: run().data?.[0] ?? null, error: null });
        },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return query;
    },
  }),
}));

import { DELETE } from "./route";

const OWNER = { id: "11111111-1111-4111-8111-111111111111", email: "client@example.com" };
const STRANGER = { id: "22222222-2222-4222-8222-222222222222", email: "other@example.com" };
const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const DOC_ID = "66666666-6666-4666-8666-666666666666";
const FILE_ID = "77777777-7777-4777-8777-777777777777";
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";
const KEY = `orders/${ORDER_ID}/address/0/file.png`;
const BASE = "http://localhost:3000";

const order: UserServiceRow = {
  id: ORDER_ID,
  user_id: OWNER.id,
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

function file(status: UserDocumentRow["status"]): Row {
  return {
    id: FILE_ID,
    user_service_id: ORDER_ID,
    service_doc_id: DOC_ID,
    applicant_index: 0,
    storage_key: KEY,
    file_name: "proof of address.png",
    mime_type: "image/png",
    size_bytes: 1_150_000,
    status,
    rejection_reason: null,
    uploaded_at: "2026-09-21T10:00:00.000Z",
    reviewed_at: null,
    reviewed_by: null,
    created_at: "2026-09-21T10:00:00.000Z",
    updated_at: "2026-09-21T10:00:00.000Z",
  };
}

function seed(status: UserDocumentRow["status"] = "uploaded", stageKey = "documents", paidAt: string | null = order.paid_at) {
  tables.user_services = [{ ...order, stage_key: stageKey, paid_at: paidAt }];
  tables.user_documents = [file(status)];
}

function remove(id: string = FILE_ID) {
  return DELETE(new Request(`${BASE}/api/documents/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
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
  session.user = OWNER;
  deleteObject.mockReset();
  deleteObject.mockImplementation(async (key: string) => {
    steps.push(`object ${key}`);
  });
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logged.mockRestore();
});

describe("DELETE /api/documents/[id]", () => {
  it("removes the row, then the object, for a file waiting for review", async () => {
    seed("uploaded");

    const response = await remove();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(steps).toEqual([`row ${FILE_ID}`, `object ${KEY}`]);
    expect(ids()).toEqual([]);
  });

  it("refuses, and keeps the file, when the firm approves it between the read and the delete", async () => {
    seed("uploaded");
    // `status` reads `uploaded` for the handler's own read and `approved`
    // from then on, which is what an approval landing meanwhile looks like.
    let reads = 0;
    Object.defineProperty(tables.user_documents[0], "status", {
      enumerable: true,
      get: () => (++reads === 1 ? "uploaded" : "approved"),
    });

    const response = await remove();

    expect(response.status).toBe(409);
    expect(await errorOf(response)).toBe("This file was approved and cannot be changed.");
    expect(deleteObject).not.toHaveBeenCalled();
    expect(ids()).toEqual([FILE_ID]);
  });

  it("removes an upload that never finished", async () => {
    seed("pending");

    const response = await remove();

    expect(response.status).toBe(200);
    expect(ids()).toEqual([]);
  });

  it("refuses an approved file", async () => {
    seed("approved");

    const response = await remove();

    expect(response.status).toBe(409);
    expect(await errorOf(response)).toBe("This file was approved and cannot be changed.");
    expect(deleteObject).not.toHaveBeenCalled();
    expect(ids()).toEqual([FILE_ID]);
  });

  it("refuses a rejected file and points at sending a new one", async () => {
    seed("rejected");

    const response = await remove();

    expect(response.status).toBe(409);
    expect(await errorOf(response)).toBe("Send a new file for this document instead.");
    expect(ids()).toEqual([FILE_ID]);
  });

  it("refuses once the order has moved past the documents stage", async () => {
    seed("uploaded", "processing");

    const response = await remove();

    expect(response.status).toBe(409);
    expect(await errorOf(response)).toBe("This file can no longer be changed.");
    expect(ids()).toEqual([FILE_ID]);
  });

  it("refuses an unpaid order", async () => {
    seed("uploaded", "documents", null);

    const response = await remove();

    expect(response.status).toBe(409);
    expect(await errorOf(response)).toBe("Payment first.");
  });

  it("refuses a stranger's file and a file that is not on record", async () => {
    seed("uploaded");
    session.user = STRANGER;
    const stranger = await remove();
    expect(stranger.status).toBe(403);
    expect(await errorOf(stranger)).toBe("This order is not yours.");

    session.user = OWNER;
    for (const id of [UNKNOWN_ID, "nope"]) {
      const missing = await remove(id);
      expect(missing.status).toBe(404);
      expect(await errorOf(missing)).toBe("This file is not on record.");
    }

    expect(deleteObject).not.toHaveBeenCalled();
    expect(ids()).toEqual([FILE_ID]);
  });

  it("keeps the row and answers a one line 500 for a key outside the order's folder", async () => {
    seed("uploaded");
    tables.user_documents[0].storage_key = `deliverables/${ORDER_ID}/file.png`;

    const response = await remove();

    expect(response.status).toBe(500);
    expect(await errorOf(response)).toBe("Something did not work. Try again.");
    expect(deleteObject).not.toHaveBeenCalled();
    expect(ids()).toEqual([FILE_ID]);
  });
});
