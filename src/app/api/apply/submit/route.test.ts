import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyCopy } from "@/content/apply";
import { totalCents } from "@/lib/apply/recommend";
import { isProductId } from "@/lib/apply/types";

/**
 * POST /api/apply/submit against a fake database: answers with a country on
 * the owner's block list are refused with 422 before anything is read or
 * written, even when every other answer is in order; allowed answers still
 * become an order.
 */

const { session, touched, inserts } = vi.hoisted(() => ({
  session: { user: null as { id: string; email: string } | null },
  /** Every table the route asked the database for, in order. */
  touched: [] as string[],
  /** Every insert, with its table. */
  inserts: [] as { table: string; rows: unknown }[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/user", () => ({ getUser: async () => session.user }));
vi.mock("@/lib/db/queries", () => ({
  getActiveQuestions: async () => {
    touched.push("questions");
    return [];
  },
  getServiceBySlug: async (_db: unknown, slug: string) => {
    touched.push("services");
    if (!isProductId(slug)) return null;
    return { id: `service-${slug}`, slug, price_cents: totalCents(slug), currency: "eur" };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      touched.push(table);
      return {
        insert(rows: unknown) {
          inserts.push({ table, rows });
          return {
            error: null,
            select: () => ({ single: async () => ({ data: { id: "order-1" }, error: null }) }),
          };
        },
      };
    },
  }),
}));

import { POST } from "./route";

function post(answers: unknown) {
  return POST(
    new Request("http://localhost/api/apply/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    }),
  );
}

const allowed = { residence: "US", applicants: "one", hasNif: [false], bank: "none", passport: ["US"] };

beforeEach(() => {
  session.user = { id: "user-1", email: "client@example.com" };
  touched.length = 0;
  inserts.length = 0;
});

describe("POST /api/apply/submit and the country block list", () => {
  it.each([
    ["a blocked address", { ...allowed, residence: "IR" }],
    ["a blocked passport", { ...allowed, passport: ["RU"] }],
    ["a blocked passport in lower case", { ...allowed, passport: ["ru"] }],
    [
      "the partner's blocked passport",
      { residence: "US", applicants: "two", hasNif: [false, false], bank: "joint", passport: ["US", "KP"], visa: "d7" },
    ],
  ])("refuses %s with 422 and writes nothing", async (_name, answers) => {
    const res = await post(answers);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: applyCopy.blocked.server });
    expect(touched).toEqual([]);
    expect(inserts).toEqual([]);
  });

  it("still asks for a session first", async () => {
    session.user = null;
    const res = await post({ ...allowed, residence: "IR" });
    expect(res.status).toBe(401);
    expect(touched).toEqual([]);
  });

  it("holds a Ukrainian address to the Crimea confirmation, and writes nothing without it", async () => {
    const res = await post({ ...allowed, residence: "UA", passport: ["UA"] });
    expect(res.status).toBe(422);
    expect(touched).toEqual([]);
  });

  it("turns allowed answers into an order", async () => {
    const res = await post(allowed);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userServiceId: "order-1" });
    expect(inserts.map((i) => i.table)).toEqual(["user_answers", "user_services", "user_service_events"]);
  });

  it("keeps the Crimea confirmation in the order's answers", async () => {
    const res = await post({ ...allowed, residence: "UA", notCrimea: true, passport: ["UA"] });
    expect(res.status).toBe(200);
    const order = inserts.find((i) => i.table === "user_services")?.rows as { answers_snapshot: unknown };
    expect(order.answers_snapshot).toMatchObject({ residence: "UA", notCrimea: true });
  });
});
