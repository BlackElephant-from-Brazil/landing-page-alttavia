import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceRow, UserServiceRow } from "@/lib/db/types";

/**
 * createCheckoutForOrder against a fake Stripe and a fake database, for the
 * URLs it hands Stripe: where the buyer comes back to. No network: the SDK
 * and the admin client are replaced before the module under test loads.
 */

const { create, retrieve, expire, priceRetrieve, mode, tables, updates } = vi.hoisted(() => ({
  create: vi.fn(),
  retrieve: vi.fn(),
  expire: vi.fn(),
  priceRetrieve: vi.fn(),
  mode: { current: "test" as "test" | "live" },
  /** The rows the fake admin client answers with, keyed by table. */
  tables: {} as Record<string, Record<string, unknown>[]>,
  /** Every update the code under test sends, in order. */
  updates: [] as { table: string; values: Record<string, unknown> }[],
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({ checkout: { sessions: { create, retrieve, expire } }, prices: { retrieve: priceRetrieve } }),
  stripeMode: () => mode.current,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const filters: [string, unknown][] = [];
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return query;
        },
        maybeSingle() {
          const rows = tables[table] ?? [];
          const match = rows.find((row) => filters.every(([column, value]) => row[column] === value));
          return Promise.resolve({ data: match ?? null, error: null });
        },
        update(values: Record<string, unknown>) {
          updates.push({ table, values });
          const chain = {
            eq: () => chain,
            is: () => Promise.resolve({ error: null }),
          };
          return chain;
        },
      };
      return query;
    },
  }),
}));

import { CheckoutError, PRICE_MISMATCH, createCheckoutForOrder } from "./checkout";

const OWNER = "11111111-1111-4111-8111-111111111111";
const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const SERVICE_ID = "44444444-4444-4444-8444-444444444444";
const SITE = "https://bank-nif-portugal.alttavia-relocation.com";

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

function sentUrls() {
  expect(create).toHaveBeenCalledTimes(1);
  const params = create.mock.calls[0][0] as { success_url: string; cancel_url: string };
  return { success: params.success_url, cancel: params.cancel_url };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  vi.stubEnv("CONTEXT", "");
  mode.current = "test";
  tables.user_services = [{ ...order }];
  tables.services = [{ ...service }];
  tables.users = [{ id: OWNER, email: "business@guyshore.com" }];
  updates.length = 0;
  create.mockReset().mockResolvedValue({ id: "cs_test_new", url: "https://checkout.stripe.com/c/pay/cs_test_new" });
  retrieve.mockReset();
  expire.mockReset().mockResolvedValue({});
  priceRetrieve.mockReset().mockResolvedValue({ id: "price_test_nif", unit_amount: 14900, currency: "eur" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createCheckoutForOrder return URLs", () => {
  it("sends the buyer back to the host the browser used, not to 0.0.0.0", async () => {
    await createCheckoutForOrder(ORDER_ID, OWNER, devRequest({ host: "localhost:3000" }));
    const { success, cancel } = sentUrls();
    expect(success).toBe("http://localhost:3000/en/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}");
    expect(cancel).toBe("http://localhost:3000/en/dashboard?checkout=cancelled");
  });

  it("keeps a LAN address a phone opened the site on", async () => {
    await createCheckoutForOrder(ORDER_ID, OWNER, devRequest({ host: "192.168.1.20:3000" }));
    expect(sentUrls().cancel).toBe("http://192.168.1.20:3000/en/dashboard?checkout=cancelled");
  });

  it("uses NEXT_PUBLIC_SITE_URL when it is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", `${SITE}/`);
    await createCheckoutForOrder(ORDER_ID, OWNER, devRequest({ host: "localhost:3000" }));
    expect(sentUrls().success).toBe(`${SITE}/en/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  });

  it("accepts an origin string and maps 0.0.0.0 to localhost", async () => {
    await createCheckoutForOrder(ORDER_ID, OWNER, "http://0.0.0.0:3000/");
    expect(sentUrls().cancel).toBe("http://localhost:3000/en/dashboard?checkout=cancelled");
  });

  it("stops before Stripe on Netlify production without NEXT_PUBLIC_SITE_URL", async () => {
    vi.stubEnv("CONTEXT", "production");
    tables.user_services = [{ ...order, stripe_checkout_session_id: "cs_test_old" }];
    await expect(createCheckoutForOrder(ORDER_ID, OWNER, devRequest({ host: SITE.slice(8) }))).rejects.toThrow(
      /NEXT_PUBLIC_SITE_URL must be set/,
    );
    expect(retrieve).not.toHaveBeenCalled();
    expect(expire).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("stores the new session id on the order", async () => {
    await createCheckoutForOrder(ORDER_ID, OWNER, devRequest({ host: "localhost:3000" }));
    expect(updates).toEqual([{ table: "user_services", values: { stripe_checkout_session_id: "cs_test_new" } }]);
  });

  it("falls back to the payment link without needing a site URL", async () => {
    vi.stubEnv("CONTEXT", "production");
    mode.current = "live";
    const { url } = await createCheckoutForOrder(ORDER_ID, OWNER, devRequest());
    expect(create).not.toHaveBeenCalled();
    const link = new URL(url);
    expect(`${link.origin}${link.pathname}`).toBe("https://buy.stripe.com/live_nif");
    expect(link.searchParams.get("client_reference_id")).toBe(ORDER_ID);
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
    const error = await createCheckoutForOrder(ORDER_ID, OWNER, devRequest({ host: "localhost:3000" })).catch((e) => e);
    expect(error).toBeInstanceOf(CheckoutError);
    return error as CheckoutError;
  }

  it("checks the price id of the current mode against the order total", async () => {
    await createCheckoutForOrder(ORDER_ID, OWNER, devRequest({ host: "localhost:3000" }));
    expect(priceRetrieve).toHaveBeenCalledWith("price_test_nif");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("refuses with 409 when the Stripe price costs something else, before any session", async () => {
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

    await createCheckoutForOrder(ORDER_ID, OWNER, devRequest({ host: "localhost:3000" }));
    expect(create).toHaveBeenCalledTimes(1);
  });
});
