import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/admin/orders/[id]/stage with the real advanceStage behind it,
 * against a fake database and stand ins for the session and the email
 * sender. The fake reads `admin_order_summary` from the `user_services`
 * rows, as the view does, and an insert lands in its table, so a second
 * move reads the events the first one wrote.
 */

type Row = Record<string, unknown>;

const { tables, hooks, session, sendEmail } = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  hooks: { failUsers: false },
  session: { user: null as { id: string; email: string; role: "client" | "admin" } | null },
  sendEmail: vi.fn(),
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

vi.mock("@/lib/email/send", () => ({ sendEmail }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const filters: [string, unknown][] = [];
      let op: "select" | "update" | "insert" = "select";
      let payload: Row = {};
      let orderBy: string | null = null;
      let limit: number | null = null;
      const source = table === "admin_order_summary" ? "user_services" : table;
      const rows = () => (tables[source] ??= []);
      const matching = () => rows().filter((row) => filters.every(([c, v]) => row[c] === v));
      const run = () => {
        if (op === "insert") {
          rows().push({ id: crypto.randomUUID(), ...payload });
          return { data: null, error: null };
        }
        if (op === "update") {
          const hit = matching();
          for (const row of hit) Object.assign(row, payload);
          return { data: hit.map((r) => ({ id: r.id })), error: null };
        }
        const hit = matching().map((r) => ({ ...r }));
        if (orderBy) hit.sort((a, b) => (a[orderBy!] as number) - (b[orderBy!] as number));
        return { data: limit === null ? hit : hit.slice(0, limit), error: null };
      };
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return query;
        },
        order(column: string) {
          orderBy = column;
          return query;
        },
        limit(count: number) {
          limit = count;
          return query;
        },
        update(values: Row) {
          op = "update";
          payload = values;
          return query;
        },
        insert(values: Row) {
          op = "insert";
          payload = values;
          return query;
        },
        maybeSingle() {
          if (table === "users" && hooks.failUsers) return Promise.reject(new Error("connection reset"));
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

import { POST } from "./route";

const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const SERVICE_ID = "44444444-4444-4444-8444-444444444444";
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";
const BASE = "http://localhost:3000";

const ADMIN = { id: "55555555-5555-4555-8555-555555555555", email: "info@alttavia-relocation.com", role: "admin" as const };
const CLIENT = { id: OWNER_ID, email: "client@example.com", role: "client" as const };

function stage(key: string, position: number, is_terminal = false): Row {
  return { id: `stage-${position}`, service_id: SERVICE_ID, key, label: key, description: null, position, is_terminal };
}

function seed(stageKey: string, overrides: Row = {}) {
  tables.user_services = [
    {
      id: ORDER_ID,
      user_id: OWNER_ID,
      service_id: SERVICE_ID,
      stage_key: stageKey,
      completed_at: null,
      paid_at: "2026-09-10T09:00:00.000Z",
      docs_required: 2,
      docs_approved: 2,
      services: { name: "NIF only" },
      ...overrides,
    },
  ];
  tables.service_stages = [
    stage("awaiting_payment", 1),
    stage("documents", 2),
    stage("awaiting_financas", 3),
    stage("nif_ready", 4, true),
  ];
  tables.users = [{ id: OWNER_ID, email: CLIENT.email }];
  tables.user_service_events = [];
}

function ctx(id: string = ORDER_ID) {
  return { params: Promise.resolve({ id }) };
}

function post(body: unknown, id: string = ORDER_ID) {
  return new Request(`${BASE}/api/admin/orders/${id}/stage`, {
    method: "POST",
    headers: { origin: BASE, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function move(body: unknown, id: string = ORDER_ID): Promise<{ status: number; json: Row }> {
  const response = await POST(post(body, id), ctx(id));
  return { status: response.status, json: (await response.json()) as Row };
}

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  hooks.failUsers = false;
  session.user = ADMIN;
  seed("awaiting_financas");

  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true, id: "email_1" });

  logged = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/admin/orders/[id]/stage, the completion email", () => {
  it("emails the owner the first time the order reaches its terminal stage and answers emailed true", async () => {
    const { status, json } = await move({ direction: "forward" });

    expect(status).toBe(200);
    expect(json).toEqual({ stageKey: "nif_ready", completed: true, emailed: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const email = sendEmail.mock.calls[0][0] as { to: string; subject: string; text: string };
    expect(email.to).toBe(CLIENT.email);
    expect(email.subject).toBe("Your NIF only order is complete");
    expect(email.text).toContain(`${BASE}/en/dashboard/orders/${ORDER_ID}`);
  });

  it("answers emailed false when the email does not go out, and the move stands", async () => {
    sendEmail.mockResolvedValue({ ok: false });

    const { status, json } = await move({ direction: "forward" });

    expect(status).toBe(200);
    expect(json).toEqual({ stageKey: "nif_ready", completed: true, emailed: false });
    expect(tables.user_services[0].stage_key).toBe("nif_ready");
    expect(typeof tables.user_services[0].completed_at).toBe("string");
  });

  it("completes again without a second email after a step back, and says nothing about one", async () => {
    await move({ direction: "forward" });
    const back = await move({ direction: "back" });
    expect(back.json).toEqual({ stageKey: "awaiting_financas", completed: false });

    const again = await move({ direction: "forward" });

    expect(again.status).toBe(200);
    expect(again.json).toEqual({ stageKey: "nif_ready", completed: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("sends nothing on a jump to the terminal stage when an earlier event already reached it", async () => {
    seed("documents");
    tables.user_service_events = [
      { id: "e1", user_service_id: ORDER_ID, from_stage: "awaiting_financas", to_stage: "nif_ready", actor_id: ADMIN.id },
      { id: "e2", user_service_id: ORDER_ID, from_stage: "nif_ready", to_stage: "documents", actor_id: ADMIN.id },
    ];

    const { status, json } = await move({ stageKey: "nif_ready" });

    expect(status).toBe(200);
    expect(json).toEqual({ stageKey: "nif_ready", completed: true });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("answers emailed false when the owner has no email on record or the lookup fails", async () => {
    tables.users = [];
    expect((await move({ direction: "forward" })).json).toEqual({ stageKey: "nif_ready", completed: true, emailed: false });

    seed("awaiting_financas");
    hooks.failUsers = true;
    const failed = await move({ direction: "forward" });
    expect(failed.status).toBe(200);
    expect(failed.json).toEqual({ stageKey: "nif_ready", completed: true, emailed: false });

    expect(sendEmail).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();
  });

  it("has no emailed key and sends nothing on a move that does not complete the order", async () => {
    seed("documents", { docs_approved: 1 });

    const { status, json } = await move({ direction: "forward" });

    expect(status).toBe(200);
    expect(json).toEqual({
      stageKey: "awaiting_financas",
      completed: false,
      warning: "Moved on with 1 of 2 required documents approved.",
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/orders/[id]/stage, refusals", () => {
  it("keeps an unpaid order on its first stage and sends nothing", async () => {
    seed("awaiting_payment", { paid_at: null });

    const { status, json } = await move({ stageKey: "nif_ready" });

    expect(status).toBe(409);
    expect(json).toEqual({ error: "Payment first." });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("answers 404 for a missing or malformed order and 400 for a body it cannot read", async () => {
    expect((await move({ direction: "forward" }, UNKNOWN_ID)).status).toBe(404);
    expect((await move({ direction: "forward" }, "nope")).status).toBe(404);
    for (const body of ["{", "[]", { direction: "sideways" }, { stageKey: "Not A Key" }]) {
      const { status, json } = await move(body);
      expect(status).toBe(400);
      expect(json).toEqual({ error: "Check the details and try again." });
    }
    expect(tables.user_services[0].stage_key).toBe("awaiting_financas");
  });

  it("answers 401 signed out and 403 for a client, and moves nothing", async () => {
    session.user = null;
    expect((await move({ direction: "forward" })).status).toBe(401);

    session.user = CLIENT;
    expect((await move({ direction: "forward" })).status).toBe(403);

    expect(tables.user_services[0].stage_key).toBe("awaiting_financas");
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
