import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyCopy } from "@/content/apply";
import { countryGateFor } from "@/lib/orders/country-gate";

/**
 * POST /api/orders, the purchase drawer, against a fake database: the
 * drawer asks no country, so the account's own applications decide. An
 * account that never sent the form, or whose form names a country on the
 * owner's block list, gets 422 and nothing is written; an account with an
 * allowed application still buys.
 */

type Row = Record<string, unknown>;

const { session, tables, inserts } = vi.hoisted(() => ({
  session: { user: null as { id: string; email: string } | null },
  tables: { user_services: [] as Record<string, unknown>[] },
  /** Every insert, with its table. */
  inserts: [] as { table: string; rows: unknown }[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/user", () => ({ getUser: async () => session.user }));
vi.mock("@/lib/db/queries", () => ({
  getServiceBySlug: async (_db: unknown, slug: string) =>
    slug === "nif-only"
      ? { id: "service-nif", slug, active: true, price_cents: 14900, currency: "eur" }
      : null,
}));

/** `select` with `eq` and `not ... is null` filters for the gate; `insert` for the order. */
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push((row) => row[column] === value);
          return query;
        },
        not(column: string, op: string, value: unknown) {
          if (op !== "is" || value !== null) throw new Error(`unexpected not(${column}, ${op})`);
          filters.push((row) => row[column] !== null && row[column] !== undefined);
          return query;
        },
        insert(rows: unknown) {
          inserts.push({ table, rows });
          return {
            error: null,
            select: () => ({ single: async () => ({ data: { id: "order-new", ...(rows as Row) }, error: null }) }),
          };
        },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          const rows = ((tables as Record<string, Row[]>)[table] ?? []).filter((row) => filters.every((keep) => keep(row)));
          return Promise.resolve({ data: rows.map((row) => ({ ...row })), error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  }),
}));

import { POST } from "./route";

const USER = { id: "user-1", email: "client@example.com" };

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

/** One order the application form wrote, with its answers. */
function application(userId: string, answers: Row): Row {
  return { user_id: userId, submission_id: `submission-${Math.random()}`, answers_snapshot: answers };
}

const allowed = { residence: "US", applicants: "one", hasNif: [false], bank: "none", passport: ["US"] };

beforeEach(() => {
  session.user = USER;
  tables.user_services = [];
  inserts.length = 0;
});

describe("POST /api/orders and the country block list", () => {
  it("sends an account that never sent the form to it, and writes nothing", async () => {
    const res = await post({ serviceSlug: "nif-only" });

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: applyCopy.blocked.applyFirst, code: "apply_first" });
    expect(inserts).toEqual([]);
  });

  it("does not count orders placed without the form (drawer, admin) as an application", async () => {
    tables.user_services = [{ user_id: USER.id, submission_id: null, answers_snapshot: {} }];

    const res = await post({ serviceSlug: "nif-only" });

    expect(res.status).toBe(422);
    expect(((await res.json()) as { code?: string }).code).toBe("apply_first");
    expect(inserts).toEqual([]);
  });

  it.each([
    ["a blocked address", { ...allowed, residence: "IR" }],
    ["a blocked passport", { ...allowed, passport: ["RU"] }],
    ["the partner's blocked passport", { ...allowed, applicants: "two", bank: "joint", passport: ["US", "kp"] }],
  ])("refuses an account whose application names %s, and writes nothing", async (_name, answers) => {
    tables.user_services = [application(USER.id, allowed), application(USER.id, answers)];

    const res = await post({ serviceSlug: "nif-only" });

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: applyCopy.blocked.server, code: "blocked" });
    expect(inserts).toEqual([]);
  });

  it("reads only the caller's own applications", async () => {
    tables.user_services = [application("someone-else", allowed)];

    const res = await post({ serviceSlug: "nif-only" });

    expect(res.status).toBe(422);
    expect(inserts).toEqual([]);
  });

  it("places the order for an account with an allowed application", async () => {
    tables.user_services = [application(USER.id, allowed)];

    const res = await post({ serviceSlug: "nif-only" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userServiceId: "order-new" });
    expect(inserts.map((i) => i.table)).toEqual(["user_services", "user_service_events"]);
  });

  it("still asks for a session first", async () => {
    session.user = null;

    const res = await post({ serviceSlug: "nif-only" });

    expect(res.status).toBe(401);
    expect(inserts).toEqual([]);
  });
});

describe("countryGateFor", () => {
  it("asks for the form when there is no application", () => {
    expect(countryGateFor([])).toBe("apply_first");
  });

  it("lets allowed applications through, a ticked Crimea box included", () => {
    expect(countryGateFor([allowed])).toBe("ok");
    expect(countryGateFor([{ ...allowed, residence: "UA", notCrimea: true, passport: ["UA"] }])).toBe("ok");
  });

  it("is blocked by any application that names a blocked country", () => {
    expect(countryGateFor([allowed, { ...allowed, residence: "SY" }])).toBe("blocked");
    expect(countryGateFor([{ ...allowed, passport: ["US", "BY"] }])).toBe("blocked");
  });

  it("reads stored answers as the submit route does, ignoring junk", () => {
    expect(countryGateFor([null, "x", { residence: "ZZ" }])).toBe("ok");
  });
});
