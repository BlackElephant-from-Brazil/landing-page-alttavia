import { describe, expect, it } from "vitest";

import type { Db } from "@/lib/db/queries";

import { MANUAL_PAYMENT_LIVE_NOTE, MANUAL_PAYMENT_TEST_NOTE } from "./manual-payment";
import { isLiveOrder, needsPaymentRecord, paidWithRealMoney } from "./live-payment";

/**
 * Which paid orders count as paid with real money, the rule that keeps the
 * firm's signature off agreements made on staging, in development and for
 * Stripe test payments, and keeps a stranger's file out of the team inbox.
 */

const PAID = "2026-09-25T10:00:00.000Z";
const ORDER_ID = "33333333-3333-4333-8333-333333333333";
/** The note of 2026-09-22, before a payment recorded outside the platform said where. */
const OLD_NOTE = "Paid outside the platform, recorded by the admin";

describe("isLiveOrder", () => {
  it("is true for an order paid through a live Checkout Session", () => {
    expect(isLiveOrder({ paid_at: PAID, stripe_checkout_session_id: "cs_live_a1B2c3" })).toBe(true);
  });

  it("is false for a test payment, whatever the events say", () => {
    expect(isLiveOrder({ paid_at: PAID, stripe_checkout_session_id: "cs_test_a1B2c3" }, [MANUAL_PAYMENT_LIVE_NOTE])).toBe(false);
  });

  it("follows the admin's record for an order paid outside the platform", () => {
    const order = { paid_at: PAID, stripe_checkout_session_id: null };
    expect(isLiveOrder(order, [MANUAL_PAYMENT_LIVE_NOTE])).toBe(true);
    expect(isLiveOrder(order, [MANUAL_PAYMENT_TEST_NOTE])).toBe(false);
    expect(isLiveOrder({ ...order, stripe_checkout_session_id: "  " }, [MANUAL_PAYMENT_LIVE_NOTE])).toBe(true);
  });

  it("reads a payment recorded before the note said where, or with no record at all, as not live", () => {
    const order = { paid_at: PAID, stripe_checkout_session_id: null };
    expect(isLiveOrder(order, [OLD_NOTE])).toBe(false);
    expect(isLiveOrder(order, [])).toBe(false);
    expect(isLiveOrder(order)).toBe(false);
    expect(isLiveOrder(order, [null, undefined, "Order created by the admin"])).toBe(false);
  });

  it("is never true for an unpaid order", () => {
    expect(isLiveOrder({ paid_at: null, stripe_checkout_session_id: "cs_live_a1B2c3" }, [MANUAL_PAYMENT_LIVE_NOTE])).toBe(false);
    expect(isLiveOrder({ paid_at: null, stripe_checkout_session_id: null }, [MANUAL_PAYMENT_LIVE_NOTE])).toBe(false);
  });

  it("takes any other session id as not live", () => {
    expect(isLiveOrder({ paid_at: PAID, stripe_checkout_session_id: "sess_123" }, [MANUAL_PAYMENT_LIVE_NOTE])).toBe(false);
  });
});

describe("needsPaymentRecord", () => {
  it("is true only for a paid order with no Checkout Session", () => {
    expect(needsPaymentRecord({ paid_at: PAID, stripe_checkout_session_id: null })).toBe(true);
    expect(needsPaymentRecord({ paid_at: PAID, stripe_checkout_session_id: " " })).toBe(true);
    expect(needsPaymentRecord({ paid_at: PAID, stripe_checkout_session_id: "cs_live_a1" })).toBe(false);
    expect(needsPaymentRecord({ paid_at: null, stripe_checkout_session_id: null })).toBe(false);
  });
});

/** A database that answers the one read paidWithRealMoney makes, and counts it. */
function eventsDb(rows: { user_service_id: string; note: string | null }[], error: string | null = null) {
  const reads: [string, unknown][][] = [];
  const db = {
    from(table: string) {
      expect(table).toBe("user_service_events");
      const filters: [string, unknown][] = [];
      const query = {
        select: () => query,
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return query;
        },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          reads.push(filters);
          const data = rows.filter((row) => filters.every(([column, value]) => (row as Record<string, unknown>)[column] === value));
          return Promise.resolve(error ? { data: null, error: { message: error } } : { data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  } as unknown as Db;
  return { db, reads };
}

describe("paidWithRealMoney", () => {
  it("reads nothing when the order's session decides", async () => {
    const { db, reads } = eventsDb([{ user_service_id: ORDER_ID, note: MANUAL_PAYMENT_LIVE_NOTE }]);
    expect(await paidWithRealMoney(db, { id: ORDER_ID, paid_at: PAID, stripe_checkout_session_id: "cs_live_x" })).toBe(true);
    expect(await paidWithRealMoney(db, { id: ORDER_ID, paid_at: PAID, stripe_checkout_session_id: "cs_test_x" })).toBe(false);
    expect(await paidWithRealMoney(db, { id: ORDER_ID, paid_at: null, stripe_checkout_session_id: null })).toBe(false);
    expect(reads).toHaveLength(0);
  });

  it("reads the order's own events for a payment recorded outside the platform", async () => {
    const order = { id: ORDER_ID, paid_at: PAID, stripe_checkout_session_id: null };
    const live = eventsDb([{ user_service_id: ORDER_ID, note: MANUAL_PAYMENT_LIVE_NOTE }]);
    expect(await paidWithRealMoney(live.db, order)).toBe(true);
    expect(live.reads).toEqual([[["user_service_id", ORDER_ID], ["note", MANUAL_PAYMENT_LIVE_NOTE]]]);

    const staging = eventsDb([{ user_service_id: ORDER_ID, note: MANUAL_PAYMENT_TEST_NOTE }]);
    expect(await paidWithRealMoney(staging.db, order)).toBe(false);

    const another = eventsDb([{ user_service_id: "another-order", note: MANUAL_PAYMENT_LIVE_NOTE }]);
    expect(await paidWithRealMoney(another.db, order)).toBe(false);
  });

  it("throws when the record cannot be read", async () => {
    const { db } = eventsDb([], "user_service_events is down");
    await expect(paidWithRealMoney(db, { id: ORDER_ID, paid_at: PAID, stripe_checkout_session_id: null })).rejects.toThrow(
      "user_service_events is down",
    );
  });
});
