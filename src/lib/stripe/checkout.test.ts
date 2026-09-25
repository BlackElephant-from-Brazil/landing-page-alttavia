import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceRow, UserServiceRow } from "@/lib/db/types";

/**
 * createCheckoutForOrder against a fake Stripe and a fake database: the URLs
 * it hands Stripe (where the buyer comes back to), the price check, the
 * record of the client's acceptance of the terms, and the euro only session.
 * No network: the SDK and the admin client are replaced before the module
 * under test loads.
 */

type Row = Record<string, unknown>;

const { create, retrieve, expire, priceRetrieve, mode, tables, updates, calls, failUpdate } = vi.hoisted(() => ({
  create: vi.fn(),
  retrieve: vi.fn(),
  expire: vi.fn(),
  priceRetrieve: vi.fn(),
  mode: { current: "test" as "test" | "live" },
  /** The rows the fake admin client answers with, keyed by table. */
  tables: {} as Record<string, Record<string, unknown>[]>,
  /** Every update the code under test sends, in order. */
  updates: [] as { table: string; values: Record<string, unknown> }[],
  /** Database writes and Stripe session creations in the order they happened. */
  calls: [] as string[],
  /** When set, an update carrying this column answers a database error. */
  failUpdate: { column: null as string | null },
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        create: (...args: unknown[]) => {
          calls.push("stripe.sessions.create");
          return create(...args);
        },
        retrieve,
        expire,
      },
    },
    prices: { retrieve: priceRetrieve },
  }),
  stripeMode: () => mode.current,
}));

/**
 * A small PostgREST stand in: `eq` and `is` filter, `update` writes into the
 * matching rows of `tables` (so a conditional update really is conditional),
 * and the answer lists the rows it matched, as `.select()` after an update does.
 */
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      let payload: Row | null = null;
      const rows = () => (tables[table] ??= []);
      const run = () => {
        const hit = rows().filter((row) => filters.every((keep) => keep(row)));
        if (payload) {
          if (failUpdate.column && failUpdate.column in payload) {
            return { data: null, error: { message: "database unavailable" } };
          }
          updates.push({ table, values: payload });
          calls.push(`update ${Object.keys(payload).join(",")}`);
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
          return Promise.resolve({ data: answer.data?.[0] ?? null, error: answer.error });
        },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return query;
    },
  }),
}));

import { createAdminClient } from "@/lib/supabase/admin";

import { CheckoutError, PRICE_MISMATCH, createCheckoutForOrder, recordTermsAcceptance } from "./checkout";

const OWNER = "11111111-1111-4111-8111-111111111111";
const STRANGER = "22222222-2222-4222-8222-222222222222";
const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const SERVICE_ID = "44444444-4444-4444-8444-444444444444";
const SITE = "https://bank-nif-portugal.alttavia-relocation.com";
const NOW = new Date("2026-09-25T09:30:00.000Z");
const ACCEPT = { version: "2026-09-25", now: NOW };
const TERMS_WRITE = "update terms_accepted_at,terms_version";

const order: UserServiceRow = {
  id: ORDER_ID,
  user_id: OWNER,
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
  created_at: "2026-09-21T10:00:00.000Z",
  updated_at: "2026-09-21T10:00:00.000Z",
};

const service = {
  id: SERVICE_ID,
  slug: "nif-only",
  name: "NIF only",
  price_cents: 14900,
  currency: "eur",
  stripe_price_id_test: "price_test_nif",
  stripe_price_id_live: null,
  stripe_payment_link_test: "https://buy.stripe.com/test_nif",
  stripe_payment_link_live: "https://buy.stripe.com/live_nif",
} as Partial<ServiceRow> as Record<string, unknown>;

function devRequest(headers: Record<string, string> = {}): Request {
  // What a dev server started with -H 0.0.0.0 sees as the request URL.
  return new Request("http://0.0.0.0:3000/api/checkout", { method: "POST", headers });
}

function checkout(from: Request | string = devRequest({ host: "localhost:3000" })) {
  return createCheckoutForOrder(ORDER_ID, OWNER, from, ACCEPT);
}

function sentUrls() {
  expect(create).toHaveBeenCalledTimes(1);
  const params = create.mock.calls[0][0] as { success_url: string; cancel_url: string };
  return { success: params.success_url, cancel: params.cancel_url };
}

function termsUpdates() {
  return updates.filter((u) => "terms_accepted_at" in u.values);
}

function storedOrder(): Row {
  return tables.user_services[0];
}

let info: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  vi.stubEnv("CONTEXT", "");
  mode.current = "test";
  tables.user_services = [{ ...order }];
  tables.services = [{ ...service }];
  tables.users = [{ id: OWNER, email: "business@guyshore.com" }];
  updates.length = 0;
  calls.length = 0;
  failUpdate.column = null;
  create.mockReset().mockResolvedValue({ id: "cs_test_new", url: "https://checkout.stripe.com/c/pay/cs_test_new" });
  retrieve.mockReset();
  expire.mockReset().mockResolvedValue({});
  priceRetrieve.mockReset().mockResolvedValue({ id: "price_test_nif", unit_amount: 14900, currency: "eur" });
  info = vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  info.mockRestore();
});

describe("createCheckoutForOrder return URLs", () => {
  it("sends the buyer back to the host the browser used, not to 0.0.0.0", async () => {
    await checkout();
    const { success, cancel } = sentUrls();
    expect(success).toBe("http://localhost:3000/en/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}");
    expect(cancel).toBe("http://localhost:3000/en/dashboard?checkout=cancelled");
  });

  it("keeps a LAN address a phone opened the site on", async () => {
    await checkout(devRequest({ host: "192.168.1.20:3000" }));
    expect(sentUrls().cancel).toBe("http://192.168.1.20:3000/en/dashboard?checkout=cancelled");
  });

  it("uses NEXT_PUBLIC_SITE_URL when it is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", `${SITE}/`);
    await checkout();
    expect(sentUrls().success).toBe(`${SITE}/en/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  });

  it("accepts an origin string and maps 0.0.0.0 to localhost", async () => {
    await checkout("http://0.0.0.0:3000/");
    expect(sentUrls().cancel).toBe("http://localhost:3000/en/dashboard?checkout=cancelled");
  });

  it("stops before Stripe on Netlify production without NEXT_PUBLIC_SITE_URL", async () => {
    vi.stubEnv("CONTEXT", "production");
    tables.user_services = [{ ...order, stripe_checkout_session_id: "cs_test_old" }];
    await expect(checkout(devRequest({ host: SITE.slice(8) }))).rejects.toThrow(/NEXT_PUBLIC_SITE_URL must be set/);
    expect(retrieve).not.toHaveBeenCalled();
    expect(expire).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("stores the new session id on the order, after the acceptance", async () => {
    await checkout();
    expect(updates).toEqual([
      { table: "user_services", values: { terms_accepted_at: NOW.toISOString(), terms_version: "2026-09-25" } },
      { table: "user_services", values: { stripe_checkout_session_id: "cs_test_new" } },
    ]);
  });

  it("falls back to the payment link without needing a site URL, and records the acceptance first", async () => {
    vi.stubEnv("CONTEXT", "production");
    mode.current = "live";
    const { url } = await createCheckoutForOrder(ORDER_ID, OWNER, devRequest(), ACCEPT);
    expect(create).not.toHaveBeenCalled();
    const link = new URL(url);
    expect(`${link.origin}${link.pathname}`).toBe("https://buy.stripe.com/live_nif");
    expect(link.searchParams.get("client_reference_id")).toBe(ORDER_ID);
    expect(termsUpdates()).toHaveLength(1);
    expect(storedOrder().terms_version).toBe("2026-09-25");
  });
});

describe("createCheckoutForOrder price check", () => {
  let logged: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logged = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logged.mockRestore();
  });

  async function refusal(): Promise<CheckoutError> {
    const error = await checkout().catch((e) => e);
    expect(error).toBeInstanceOf(CheckoutError);
    return error as CheckoutError;
  }

  it("checks the price id of the current mode against the order total", async () => {
    await checkout();
    expect(priceRetrieve).toHaveBeenCalledWith("price_test_nif");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("refuses with 409 when the Stripe price costs something else, before any session or record", async () => {
    priceRetrieve.mockResolvedValue({ id: "price_test_nif", unit_amount: 49700, currency: "eur" });

    const error = await refusal();

    expect(error.status).toBe(409);
    expect(error.message).toBe(PRICE_MISMATCH);
    expect(create).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it("refuses when the currency differs", async () => {
    priceRetrieve.mockResolvedValue({ id: "price_test_nif", unit_amount: 14900, currency: "usd" });

    expect((await refusal()).status).toBe(409);
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a price with no fixed amount", async () => {
    priceRetrieve.mockResolvedValue({ id: "price_test_nif", unit_amount: null, currency: "eur" });

    expect((await refusal()).message).toBe(PRICE_MISMATCH);
  });

  it("never hands out an open session made at the wrong price", async () => {
    tables.user_services = [{ ...order, stripe_checkout_session_id: "cs_test_old" }];
    retrieve.mockResolvedValue({ id: "cs_test_old", status: "open", url: "https://checkout.stripe.com/c/pay/cs_test_old" });
    priceRetrieve.mockResolvedValue({ id: "price_test_nif", unit_amount: 9900, currency: "eur" });

    expect((await refusal()).status).toBe(409);
    expect(retrieve).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("accepts the currency in any case", async () => {
    priceRetrieve.mockResolvedValue({ id: "price_test_nif", unit_amount: 14900, currency: "EUR" });

    await checkout();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("refuses another account's order and a paid one without writing anything", async () => {
    const foreign = await createCheckoutForOrder(ORDER_ID, STRANGER, devRequest(), ACCEPT).catch((e) => e);
    expect(foreign).toBeInstanceOf(CheckoutError);
    expect((foreign as CheckoutError).status).toBe(403);

    tables.user_services = [{ ...order, paid_at: "2026-09-24T10:00:00.000Z" }];
    const paid = await checkout().catch((e) => e);
    expect((paid as CheckoutError).status).toBe(409);

    expect(updates).toHaveLength(0);
    expect(priceRetrieve).not.toHaveBeenCalled();
  });
});

describe("createCheckoutForOrder terms acceptance", () => {
  it("records the date and the version on the order before any session exists", async () => {
    await checkout();

    expect(storedOrder()).toMatchObject({ terms_accepted_at: NOW.toISOString(), terms_version: "2026-09-25" });
    expect(calls.indexOf(TERMS_WRITE)).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf(TERMS_WRITE)).toBeLessThan(calls.indexOf("stripe.sessions.create"));
    expect(info).toHaveBeenCalledWith(expect.stringContaining(`order ${ORDER_ID} accepted the service terms version 2026-09-25`));
  });

  it("keeps the click that leads to payment: a later Pay click on the unpaid order records its own version", async () => {
    await checkout();
    retrieve.mockResolvedValue({
      id: "cs_test_new",
      status: "open",
      url: "https://checkout.stripe.com/c/pay/cs_test_new",
      adaptive_pricing: { enabled: false },
    });
    // The client left, the wording moved on, and the client came back to pay.
    await createCheckoutForOrder(ORDER_ID, OWNER, devRequest({ host: "localhost:3000" }), {
      version: "2026-10-01",
      now: new Date("2026-09-26T08:00:00.000Z"),
    });

    expect(termsUpdates()).toHaveLength(2);
    expect(storedOrder()).toMatchObject({ terms_accepted_at: "2026-09-26T08:00:00.000Z", terms_version: "2026-10-01" });
  });

  it("rewrites an acceptance an unpaid order carries from an earlier click", async () => {
    tables.user_services = [{ ...order, terms_accepted_at: "2026-09-20T12:00:00.000Z", terms_version: "2026-09-20" }];

    await checkout();

    expect(termsUpdates()).toHaveLength(1);
    expect(storedOrder()).toMatchObject({ terms_accepted_at: NOW.toISOString(), terms_version: "2026-09-25" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("stops before a checkout URL exists when the record cannot be written", async () => {
    failUpdate.column = "terms_accepted_at";

    await expect(checkout()).rejects.toThrow(/recordTermsAcceptance: database unavailable/);
    expect(create).not.toHaveBeenCalled();
    expect(retrieve).not.toHaveBeenCalled();
  });
});

describe("recordTermsAcceptance", () => {
  it("never moves the record of an order paid after this call read it", async () => {
    // The row in the database is paid, with the acceptance of the click that
    // paid it; the order this call holds was read before the payment landed.
    tables.user_services = [
      {
        ...order,
        paid_at: "2026-09-25T09:31:00.000Z",
        terms_accepted_at: "2026-09-25T09:29:59.000Z",
        terms_version: "2026-09-25",
      },
    ];

    const answer = await recordTermsAcceptance(createAdminClient(), { ...order }, { version: "2026-10-01", now: NOW });

    expect(answer).toBe("kept");
    expect(storedOrder()).toMatchObject({ terms_accepted_at: "2026-09-25T09:29:59.000Z", terms_version: "2026-09-25" });
    expect(info).not.toHaveBeenCalled();
  });

  it("writes only the caller's own order", async () => {
    const answer = await recordTermsAcceptance(createAdminClient(), { ...order, user_id: STRANGER }, ACCEPT);

    expect(answer).toBe("kept");
    expect(storedOrder().terms_accepted_at).toBeUndefined();
  });

  it("answers recorded when it wrote the row", async () => {
    expect(await recordTermsAcceptance(createAdminClient(), { ...order }, ACCEPT)).toBe("recorded");
  });
});

describe("createCheckoutForOrder currency", () => {
  it("creates every session with Adaptive Pricing off, so the charge is in euros", async () => {
    await checkout();
    expect(create.mock.calls[0][0]).toMatchObject({ mode: "payment", adaptive_pricing: { enabled: false } });
  });

  it("reuses an open session that charges in euros", async () => {
    tables.user_services = [{ ...order, stripe_checkout_session_id: "cs_test_old" }];
    retrieve.mockResolvedValue({
      id: "cs_test_old",
      status: "open",
      url: "https://checkout.stripe.com/c/pay/cs_test_old",
      adaptive_pricing: { enabled: false },
    });

    const { url } = await checkout();

    expect(url).toBe("https://checkout.stripe.com/c/pay/cs_test_old");
    expect(expire).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("replaces an open session made with Adaptive Pricing on", async () => {
    tables.user_services = [{ ...order, stripe_checkout_session_id: "cs_test_old" }];
    retrieve.mockResolvedValue({
      id: "cs_test_old",
      status: "open",
      url: "https://checkout.stripe.com/c/pay/cs_test_old",
      adaptive_pricing: { enabled: true },
    });

    const { url } = await checkout();

    expect(expire).toHaveBeenCalledWith("cs_test_old");
    expect(create).toHaveBeenCalledTimes(1);
    expect(url).toBe("https://checkout.stripe.com/c/pay/cs_test_new");
  });
});
