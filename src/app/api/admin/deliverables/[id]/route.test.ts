import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * DELETE /api/admin/deliverables/[id] with the real deleteDeliverable behind
 * it, against a fake database and stand ins for the session and the bucket.
 * `steps` records the bucket removal and the row removal in the order they
 * happened.
 */

type Row = Record<string, unknown>;

const { tables, steps, session, deleteObject, presignDownload } = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  steps: [] as string[],
  session: { user: null as { id: string; email: string; role: "client" | "admin" } | null },
  deleteObject: vi.fn(),
  presignDownload: vi.fn(),
}));

vi.mock("@/lib/supabase/admin-user", () => {
  class AdminAuthError extends Error {
    readonly status: 401 | 403;
    constructor(status: 401 | 403) {
      super(status === 401 ? "Sign in to continue." : "Not allowed.");
      this.status = status;
    }
  }
  return {
    AdminAuthError,
    requireAdmin: async () => {
      if (!session.user) throw new AdminAuthError(401);
      if (session.user.role !== "admin") throw new AdminAuthError(403);
      return session.user;
    },
    adminErrorResponse: (error: unknown) => {
      if (error instanceof AdminAuthError) return Response.json({ error: error.message }, { status: error.status });
      console.error("admin route failed:", error);
      return Response.json({ error: "Something went wrong on our side." }, { status: 500 });
    },
  };
});

vi.mock("@/lib/r2/client", () => ({ deleteObject, presignDownload, headObjectSize: vi.fn(), presignUpload: vi.fn() }));

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
          steps.push(`row ${hit.map((r) => r.id).join(",")}`);
          return { data: null, error: null };
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

const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const DELIVERABLE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";
const KEY = `deliverables/${ORDER_ID}/abc.pdf`;
const BASE = "http://localhost:3000";

const ADMIN = { id: "55555555-5555-4555-8555-555555555555", email: "info@alttavia-relocation.com", role: "admin" as const };
const CLIENT = { id: "11111111-1111-4111-8111-111111111111", email: "client@example.com", role: "client" as const };

function ctx(id: string = DELIVERABLE_ID) {
  return { params: Promise.resolve({ id }) };
}

function del(id: string = DELIVERABLE_ID) {
  return new Request(`${BASE}/api/admin/deliverables/${id}`, { method: "DELETE" });
}

async function errorOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: string }).error;
}

function ids(): unknown[] {
  return (tables.user_service_deliverables ?? []).map((r) => r.id);
}

let logged: ReturnType<typeof vi.spyOn>;
let audited: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  tables.user_service_deliverables = [
    {
      id: DELIVERABLE_ID,
      user_service_id: ORDER_ID,
      service_deliverable_id: null,
      label: "NIF certificate",
      storage_key: KEY,
      status: "ready",
      file_name: "nif.pdf",
      mime_type: "application/pdf",
      size_bytes: 2048,
    },
    { id: OTHER_ID, user_service_id: ORDER_ID, label: "Report", storage_key: `deliverables/${ORDER_ID}/other.pdf`, status: "ready" },
  ];
  steps.length = 0;
  session.user = ADMIN;

  deleteObject.mockReset();
  deleteObject.mockImplementation(async (key: string) => {
    steps.push(`object ${key}`);
  });
  presignDownload.mockReset();

  logged = vi.spyOn(console, "error").mockImplementation(() => {});
  audited = vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DELETE /api/admin/deliverables/[id]", () => {
  it("removes the object, then the row, and answers deleted", async () => {
    const response = await DELETE(del(), ctx());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(steps).toEqual([`object ${KEY}`, `row ${DELIVERABLE_ID}`]);
    expect(ids()).toEqual([OTHER_ID]);
    expect(audited).toHaveBeenCalledWith(`[admin] ${ADMIN.id} deliverable.delete ${DELIVERABLE_ID} order ${ORDER_ID}`);
  });

  it("answers 404 This file is not on record. for a missing row and a malformed id, and deletes nothing", async () => {
    for (const [request, context] of [
      [del(UNKNOWN_ID), ctx(UNKNOWN_ID)],
      [del("nope"), ctx("nope")],
    ] as const) {
      const response = await DELETE(request, context);
      expect(response.status).toBe(404);
      expect(await errorOf(response)).toBe("This file is not on record.");
    }
    expect(deleteObject).not.toHaveBeenCalled();
    expect(ids()).toEqual([DELIVERABLE_ID, OTHER_ID]);
  });

  it("answers 404 the second time, once the file is gone", async () => {
    expect((await DELETE(del(), ctx())).status).toBe(200);

    const again = await DELETE(del(), ctx());

    expect(again.status).toBe(404);
    expect(deleteObject).toHaveBeenCalledTimes(1);
  });

  it("keeps the row and answers a one line 500 when the bucket fails", async () => {
    deleteObject.mockRejectedValueOnce(new Error("no credentials"));

    const response = await DELETE(del(), ctx());

    expect(response.status).toBe(500);
    expect(await errorOf(response)).toBe("Something went wrong on our side.");
    expect(logged).toHaveBeenCalled();
    expect(ids()).toEqual([DELIVERABLE_ID, OTHER_ID]);
  });

  it("refuses a row whose key sits outside the order's folder", async () => {
    tables.user_service_deliverables[0].storage_key = `documents/${ORDER_ID}/passport.pdf`;

    const response = await DELETE(del(), ctx());

    expect(response.status).toBe(500);
    expect(await errorOf(response)).toBe("Something went wrong on our side.");
    expect(deleteObject).not.toHaveBeenCalled();
    expect(ids()).toEqual([DELIVERABLE_ID, OTHER_ID]);
  });

  it("answers 401 signed out and 403 for a client, and deletes nothing", async () => {
    session.user = null;
    const signedOut = await DELETE(del(), ctx());
    expect(signedOut.status).toBe(401);

    session.user = CLIENT;
    const client = await DELETE(del(), ctx());
    expect(client.status).toBe(403);
    expect(await errorOf(client)).toBe("Not allowed.");

    expect(deleteObject).not.toHaveBeenCalled();
    expect(ids()).toEqual([DELIVERABLE_ID, OTHER_ID]);
  });
});
