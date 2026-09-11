import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserServiceRow } from "@/lib/db/types";

/**
 * confirmCheckoutSession against a fake Stripe and a fake database. No
 * network: the Stripe SDK and the admin client are replaced with vi.mock
 * before the module under test loads, and markOrderPaid is a spy so the test
 * can assert what would have been written without a database.
 */

// vi.mock is hoisted above every import, so anything a factory touches has to
// be hoisted with it.
const { retrieve, markOrderPaid, tables } = vi.hoisted(() => ({
  retrieve: vi.fn(),
  markOrderPaid: vi.fn(),
  /** The rows the fake admin client answers with, keyed by table. */
  tables: { user_services: [] } as Record<string, Record<string, unknown>[]>,
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({ checkout: { sessions: { retrieve } } }),
}));

vi.mock("@/lib/orders/mark-paid", () => ({ markOrderPaid }));

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
      };
      return query;
    },
  }),
}));

import { confirmCheckoutSession } from "./confirm";

const OWNER = "11111111-1111-4111-8111-111111111111";
const STRANGER = "22222222-2222-4222-8222-222222222222";
const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const SESSION_ID = "cs_test_a1B2c3D4e5F6g7H8";

const order: UserServiceRow = {
  id: ORDER_ID,
  user_id: OWNER,
  service_id: "44444444-4444-4444-8444-444444444444",
  submission_id: null,
  answers_snapshot: { applicants: "one", hasNif: [false], bank: "yes" },
  quantity: 1,
  joint: false,
  applicants: 1,
  total_cents: 49700,
  currency: "eur",
  stage_key: "awaiting_payment",
  stripe_checkout_session_id: null,
  stripe_payment_intent_id: null,
  paid_at: null,
  completed_at: null,
  report: null,
  created_at: "2026-09-11T10:00:00.000Z",
  updated_at: "2026-09-11T10:00:00.000Z",
};

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    object: "checkout.session",
    payment_status: "paid",
    client_reference_id: ORDER_ID,
    amount_total: 49700,
    currency: "eur",
    payment_intent: "pi_test_123",
    ...overrides,
  };
}

beforeEach(() => {
  retrieve.mockReset();
  markOrderPaid.mockReset();
  markOrderPaid.mockResolvedValue({ changed: true, stageKey: "documents" });
  tables.user_services = [order];
});

describe("confirmCheckoutSession", () => {
  it("marks the order paid when the session is paid for the right amount", async () => {
    retrieve.mockResolvedValue(session());

    const result = await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(result).toEqual({ ok: true, userServiceId: ORDER_ID });
    expect(markOrderPaid).toHaveBeenCalledWith(ORDER_ID, {
      sessionId: SESSION_ID,
      paymentIntentId: "pi_test_123",
      amountCents: 49700,
      currency: "eur",
    });
  });

  it("accepts the currency in any case and an expanded payment intent", async () => {
    retrieve.mockResolvedValue(session({ currency: "EUR", payment_intent: { id: "pi_test_456" } }));

    const result = await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(result.ok).toBe(true);
    expect(markOrderPaid).toHaveBeenCalledWith(ORDER_ID, expect.objectContaining({ paymentIntentId: "pi_test_456" }));
  });

  it("refuses a session that is not paid", async () => {
    retrieve.mockResolvedValue(session({ payment_status: "unpaid" }));

    const result = await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(result.ok).toBe(false);
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("refuses a session whose amount differs from the order total", async () => {
    retrieve.mockResolvedValue(session({ amount_total: 14900 }));

    const result = await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(result).toEqual({ ok: false, reason: "Paid amount does not match the order." });
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("refuses a session whose currency differs from the order", async () => {
    retrieve.mockResolvedValue(session({ currency: "usd" }));

    const result = await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(result.ok).toBe(false);
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("refuses an order that belongs to another account", async () => {
    retrieve.mockResolvedValue(session());

    const result = await confirmCheckoutSession(SESSION_ID, STRANGER);

    expect(result).toEqual({ ok: false, reason: "This order belongs to another account." });
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("refuses a session that references no known order", async () => {
    retrieve.mockResolvedValue(session({ client_reference_id: "55555555-5555-4555-8555-555555555555" }));

    const result = await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(result.ok).toBe(false);
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("never calls Stripe for a malformed session id", async () => {
    const result = await confirmCheckoutSession("../etc/passwd", OWNER);

    expect(result.ok).toBe(false);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("reports a session Stripe cannot find without throwing", async () => {
    retrieve.mockRejectedValue(new Error("No such checkout.session"));

    const result = await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(result).toEqual({ ok: false, reason: "Session not found." });
  });

  it("reports a failed write without throwing", async () => {
    retrieve.mockResolvedValue(session());
    markOrderPaid.mockRejectedValue(new Error("connection reset"));

    const result = await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(result.ok).toBe(false);
  });
});
