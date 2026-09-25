import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TERMS_REQUIRED, TERMS_VERSION } from "@/content/terms-version";
import type { UserServiceRow } from "@/lib/db/types";

/**
 * POST /api/checkout with the real createCheckoutForOrder behind it, against
 * a fake database and a fake Stripe: the acceptance of the terms is required
 * before anything is read or sent, recorded once on the order, and never
 * overwritten.
 */

type Row = Record<string, unknown>;

const { session, tables, touched, termsWrites, create, retrieve, expire, priceRetrieve } = vi.hoisted(() => ({
  session: { user: null as { id: string; email: string } | null },
  tables: {} as Record<string, Record<string, unknown>[]>,
  /** Every table the route asked the database for, in order. */
  touched: [] as string[],
  /** Every update that carried the acceptance columns. */
  termsWrites: [] as Record<string, unknown>[],
  create: vi.fn(),
  retrieve: vi.fn(),
  expire: vi.fn(),
  priceRetrieve: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/user", () => ({ getUser: async () => session.user }));
vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({ checkout: { sessions: { create, retrieve, expire } }, prices: { retrieve: priceRetrieve } }),
  stripeMode: () => "test",
}));

/** `eq` and `is` filter; `update` writes into the matching rows and answers them. */
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      touched.push(table);
      const filters: ((row: Row) => boolean)[] = [];
      let payload: Row | null = null;
      const run = () => {
        const hit = (tables[table] ?? []).filter((row) => filters.every((keep) => keep(row)));
        if (payload) {
          if ("terms_accepted_at" in payload) termsWrites.push(payload);
          for (const row of hit) Object.assign(row, payload);
        }
        return { data: hit.map((row) => ({ ...row })), error: null };
      };
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push((row) => row[column] === value);
          return query;
        },
        is(column: string, value: null) {
          filters.push((row) => (row[column] ?? null) === value);
          return query;
        },
        update(values: Row) {
          payload = values;
          return query;
        },
        maybeSingle() {
          const answer = run();
          return Promise.resolve({ data: answer.data[0] ?? null, error: answer.error });
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
const SESSION_URL = "https://checkout.stripe.com/c/pay/cs_test_new";

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
  stage_key: "awaiting_payment",
  stripe_checkout_session_id: null,
  stripe_payment_intent_id: null,
  paid_at: null,
  completed_at: null,
  report: null,
  created_at: "2026-09-25T09:00:00.000Z",
  updated_at: "2026-09-25T09:00:00.000Z",
};

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost:3000/api/checkout", {
      method: "POST",
      headers: { host: "localhost:3000", "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

function storedOrder(): Row {
  return tables.user_services[0];
}

let info: ReturnType<typeof vi.spyOn>;
let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  vi.stubEnv("CONTEXT", "");
  session.user = OWNER;
  tables.user_services = [{ ...order }];
  tables.services = [
    {
      id: SERVICE_ID,
      slug: "nif-only",
      stripe_price_id_test: "price_test_nif",
      stripe_price_id_live: null,
      stripe_payment_link_test: "https://buy.stripe.com/test_nif",
      stripe_payment_link_live: null,
    },
  ];
  tables.users = [
    { id: OWNER.id, email: OWNER.email },
    { id: STRANGER.id, email: STRANGER.email },
  ];
  touched.length = 0;
  termsWrites.length = 0;
  create.mockReset().mockResolvedValue({ id: "cs_test_new", url: SESSION_URL });
  retrieve.mockReset().mockResolvedValue({ id: "cs_test_new", status: "open", url: SESSION_URL, adaptive_pricing: { enabled: false } });
  expire.mockReset().mockResolvedValue({});
  priceRetrieve.mockReset().mockResolvedValue({ id: "price_test_nif", unit_amount: 14900, currency: "eur" });
  info = vi.spyOn(console, "info").mockImplementation(() => {});
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  info.mockRestore();
  logged.mockRestore();
});

function nothingTouched() {
  expect(touched).toEqual([]);
  expect(priceRetrieve).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
  expect(termsWrites).toEqual([]);
}

describe("POST /api/checkout acceptance of the terms", () => {
  it.each([
    ["missing", { userServiceId: ORDER_ID }],
    ["false", { userServiceId: ORDER_ID, acceptTerms: false }],
    ["the string true", { userServiceId: ORDER_ID, acceptTerms: "true" }],
    ["the number 1", { userServiceId: ORDER_ID, acceptTerms: 1 }],
    ["null", { userServiceId: ORDER_ID, acceptTerms: null }],
  ])("answers 422 when acceptTerms is %s, before reading the order or calling Stripe", async (_label, body) => {
    const response = await post(body);

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: TERMS_REQUIRED });
    expect(TERMS_REQUIRED).toBe("Accept the terms to continue.");
    nothingTouched();
  });

  it("records the acceptance with today's version and answers the checkout URL", async () => {
    const response = await post({ userServiceId: ORDER_ID, acceptTerms: true });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: SESSION_URL });
    expect(termsWrites).toHaveLength(1);
    expect(storedOrder().terms_version).toBe(TERMS_VERSION);
    expect(Date.parse(String(storedOrder().terms_accepted_at))).not.toBeNaN();
    expect(info).toHaveBeenCalledTimes(1);
  });

  it("records every Pay click of the unpaid order, so the last one is the click that paid", async () => {
    const first = await post({ userServiceId: ORDER_ID, acceptTerms: true });
    const second = await post({ userServiceId: ORDER_ID, acceptTerms: true });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ url: SESSION_URL });
    expect(termsWrites).toHaveLength(2);
    expect(storedOrder().terms_version).toBe(TERMS_VERSION);
  });

  it("replaces an acceptance of an older wording that an unpaid order carries", async () => {
    tables.user_services = [{ ...order, terms_accepted_at: "2026-09-20T12:00:00.000Z", terms_version: "2026-09-20" }];

    const response = await post({ userServiceId: ORDER_ID, acceptTerms: true });

    expect(response.status).toBe(200);
    expect(termsWrites).toHaveLength(1);
    expect(storedOrder().terms_version).toBe(TERMS_VERSION);
    expect(storedOrder().terms_accepted_at).not.toBe("2026-09-20T12:00:00.000Z");
  });

  it("writes nothing on another account's order", async () => {
    session.user = STRANGER;

    const response = await post({ userServiceId: ORDER_ID, acceptTerms: true });

    expect(response.status).toBe(403);
    expect(termsWrites).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it("writes nothing on a paid order", async () => {
    tables.user_services = [{ ...order, paid_at: "2026-09-24T10:00:00.000Z" }];

    const response = await post({ userServiceId: ORDER_ID, acceptTerms: true });

    expect(response.status).toBe(409);
    expect(termsWrites).toEqual([]);
  });
});

describe("POST /api/checkout input", () => {
  it("answers 401 without a session, before anything else", async () => {
    session.user = null;

    const response = await post({ userServiceId: ORDER_ID, acceptTerms: true });

    expect(response.status).toBe(401);
    nothingTouched();
  });

  it.each([
    ["an unreadable body", "{"],
    ["an array", [ORDER_ID]],
    ["a bad order id", { userServiceId: "order-1", acceptTerms: true }],
  ])("answers 400 for %s", async (_label, body) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(typeof ((await response.json()) as { error?: unknown }).error).toBe("string");
    nothingTouched();
  });

  it("answers 404 for an order that does not exist", async () => {
    tables.user_services = [];

    const response = await post({ userServiceId: ORDER_ID, acceptTerms: true });

    expect(response.status).toBe(404);
    expect(termsWrites).toEqual([]);
  });
});
