import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/stripe/webhook with a fake Stripe, a stubbed verification and a
 * spied team notice: which ignored sessions tell the team. No network.
 */

const { constructEvent, verifyPaidSession, settleVerifiedSession, notifyPaymentMismatch } = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  verifyPaidSession: vi.fn(),
  settleVerifiedSession: vi.fn(),
  notifyPaymentMismatch: vi.fn(),
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({ webhooks: { constructEvent } }),
  isLiveMode: () => false,
}));

vi.mock("@/lib/stripe/confirm", () => ({ verifyPaidSession, settleVerifiedSession }));

vi.mock("@/lib/orders/notify", () => ({ notifyPaymentMismatch }));

import { POST } from "./route";

const ORDER = { id: "33333333-3333-4333-8333-333333333333", total_cents: 14900, currency: "eur" };
const SESSION = { id: "cs_test_a1B2c3", amount_total: 49700, currency: "eur", payment_status: "paid" };

function webhook(): Request {
  return new Request("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=fake" },
    body: "{}",
  });
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_fake");
  constructEvent.mockReset().mockReturnValue({
    type: "checkout.session.completed",
    livemode: false,
    data: { object: SESSION },
  });
  verifyPaidSession.mockReset();
  settleVerifiedSession.mockReset().mockResolvedValue({ ok: true, userServiceId: ORDER.id });
  notifyPaymentMismatch.mockReset().mockResolvedValue(true);
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  warn.mockRestore();
});

describe("POST /api/stripe/webhook", () => {
  it("tells the team when a paid session names an order with another amount, and still answers 200", async () => {
    verifyPaidSession.mockResolvedValue({
      ok: false,
      reason: "Paid amount does not match the order.",
      mismatchedOrder: ORDER,
    });

    const res = await POST(webhook());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, ignored: "Paid amount does not match the order." });
    expect(notifyPaymentMismatch).toHaveBeenCalledWith({
      order: ORDER,
      sessionId: SESSION.id,
      paidCents: 49700,
      paidCurrency: "eur",
    });
    expect(settleVerifiedSession).not.toHaveBeenCalled();
  });

  it("stays quiet for any other ignored session", async () => {
    verifyPaidSession.mockResolvedValue({ ok: false, reason: "Payment not completed." });

    const res = await POST(webhook());

    expect(res.status).toBe(200);
    expect(notifyPaymentMismatch).not.toHaveBeenCalled();
  });

  it("settles a verified session without a notice", async () => {
    verifyPaidSession.mockResolvedValue({ ok: true, verified: { order: ORDER } });

    const res = await POST(webhook());

    expect(res.status).toBe(200);
    expect(settleVerifiedSession).toHaveBeenCalledTimes(1);
    expect(notifyPaymentMismatch).not.toHaveBeenCalled();
  });
});
