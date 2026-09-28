import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/stripe/webhook with a fake Stripe, a stubbed verification, a
 * spied team notice and a spied operations alert: which ignored sessions
 * tell the team, which refusals schedule an alert after the answer, and
 * that the answers are the ones the route gave before alerts existed. No
 * network.
 */

const { constructEvent, verifyPaidSession, settleVerifiedSession, notifyPaymentMismatch, sendOpsAlert, scheduled } = vi.hoisted(
  () => ({
    constructEvent: vi.fn(),
    verifyPaidSession: vi.fn(),
    settleVerifiedSession: vi.fn(),
    notifyPaymentMismatch: vi.fn(),
    sendOpsAlert: vi.fn(),
    /** The callbacks the route handed to after(), run by the test once the answer is in. */
    scheduled: [] as (() => unknown)[],
  }),
);

vi.mock("next/server", () => ({
  after: (task: () => unknown) => {
    scheduled.push(task);
  },
}));

vi.mock("@/lib/ops/alerts", () => ({ sendOpsAlert }));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({ webhooks: { constructEvent } }),
  isLiveMode: () => false,
}));

vi.mock("@/lib/stripe/confirm", () => ({ verifyPaidSession, settleVerifiedSession }));

vi.mock("@/lib/orders/notify", () => ({ notifyPaymentMismatch }));

import { POST } from "./route";

const ORDER = { id: "33333333-3333-4333-8333-333333333333", total_cents: 14900, currency: "eur" };
const SESSION = { id: "cs_test_a1B2c3", amount_total: 49700, currency: "eur", payment_status: "paid" };

/** A header of Stripe's own shape, timed `offsetSeconds` from now. It never verifies: constructEvent is a mock. */
function stripeHeader(offsetSeconds = 0): string {
  return `t=${Math.floor(Date.now() / 1000) + offsetSeconds},v1=${"a".repeat(64)}`;
}

const SIX_HOURS = 6 * 60 * 60 * 1000;

function webhook(body: string = "{}", signature: string | null = stripeHeader()): Request {
  return new Request("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    headers: signature === null ? {} : { "stripe-signature": signature },
    body,
  });
}

/** Runs what the route scheduled with after() and answers the alerts it sent, in order. */
async function alertsAfterResponse(): Promise<Record<string, unknown>[]> {
  for (const task of scheduled.splice(0)) await task();
  return sendOpsAlert.mock.calls.map((call) => call[0] as Record<string, unknown>);
}

let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

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
  sendOpsAlert.mockReset().mockResolvedValue("sent");
  scheduled.length = 0;
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  warn.mockRestore();
  error.mockRestore();
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

describe("POST /api/stripe/webhook: operations alerts", () => {
  it("answers 503 as before without the secret, and alerts after the answer", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");

    const res = await POST(webhook());

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "STRIPE_WEBHOOK_SECRET is not set. Add it to the environment and redeploy." });
    expect(sendOpsAlert).not.toHaveBeenCalled();
    const [alert] = await alertsAfterResponse();
    expect(alert).toMatchObject({ kind: "webhook", key: "missing_secret", windowMs: SIX_HOURS, failOpen: false });
    expect(sendOpsAlert).toHaveBeenCalledTimes(1);
  });

  it("answers 400 as before without a signature header, and only logs it", async () => {
    const res = await POST(webhook("{}", null));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Missing stripe-signature header." });
    expect(scheduled).toHaveLength(0);
    expect(await alertsAfterResponse()).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("answers 400 as before on a signature that does not verify, and alerts with the claimed event only", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature for payload.");
    });
    const body = JSON.stringify({
      id: "evt_1QabcDEF234",
      type: "checkout.session.completed",
      data: { object: { customer_details: { email: "ana@example.com", name: "Ana Silva" } } },
    });

    const res = await POST(webhook(body));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid signature." });
    const [alert] = await alertsAfterResponse();
    expect(alert).toMatchObject({ kind: "webhook", key: "invalid_signature", windowMs: SIX_HOURS, failOpen: false });
    expect(alert.facts).toEqual(
      expect.arrayContaining([
        { label: "Answer", value: "400" },
        { label: "Claimed event", value: "evt_1QabcDEF234" },
        { label: "Claimed type", value: "checkout.session.completed" },
      ]),
    );
    const serialised = JSON.stringify(alert);
    expect(serialised).not.toContain("ana@example.com");
    expect(serialised).not.toContain("Ana Silva");
  });

  it("logs only the error's name and message, never the payload Stripe's error carries", async () => {
    const body = JSON.stringify({ id: "evt_1QabcDEF234", data: { object: { customer_details: { email: "ana@example.com" } } } });
    constructEvent.mockImplementation(() => {
      const failure = new Error("No signatures found matching the expected signature for payload.");
      Object.assign(failure, { name: "StripeSignatureVerificationError", payload: body, header: "t=1,v1=secret" });
      throw failure;
    });

    await POST(webhook(body));

    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain("StripeSignatureVerificationError: No signatures found");
    expect(logged).not.toContain("ana@example.com");
    expect(logged).not.toContain("t=1,v1=secret");
  });

  it.each([
    ["a header of another shape", "t=1,v1=fake"],
    ["no v1 signature", `t=${Math.floor(Date.now() / 1000)},v0=${"a".repeat(64)}`],
    ["a timestamp outside the tolerance", stripeHeader(-3600)],
    ["plain junk", "x"],
  ])("answers 400 and only logs a failed signature with %s", async (_, header) => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });

    const res = await POST(webhook("{}", header));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid signature." });
    expect(scheduled).toHaveLength(0);
    expect(sendOpsAlert).not.toHaveBeenCalled();
  });

  it("does not repeat unverified values of another shape", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });

    await POST(webhook(JSON.stringify({ id: "<script>", type: "ana@example.com" })));

    const [alert] = await alertsAfterResponse();
    expect(alert.facts).toEqual(
      expect.arrayContaining([
        { label: "Claimed event", value: "Not readable" },
        { label: "Claimed type", value: "Not readable" },
      ]),
    );
  });

  it("answers 500 as before when the payment cannot be recorded, and alerts with the event, the session and the order", async () => {
    constructEvent.mockReturnValue({
      id: "evt_1QrecordFAIL9",
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          ...SESSION,
          client_reference_id: ORDER.id,
          customer_details: { email: "ana@example.com", name: "Ana Silva" },
        },
      },
    });
    verifyPaidSession.mockRejectedValue(new Error("verifyPaidSession: connection terminated"));

    const res = await POST(webhook());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Could not record the payment." });
    const [alert] = await alertsAfterResponse();
    expect(alert).toMatchObject({
      kind: "webhook",
      key: `record_failed:${ORDER.id}`,
      link: { label: "Open the order", path: `/admin/orders?order=${ORDER.id}` },
    });
    expect(alert.facts).toEqual(
      expect.arrayContaining([
        { label: "Stripe event", value: "evt_1QrecordFAIL9" },
        { label: "Event type", value: "checkout.session.completed" },
        { label: "Stripe session", value: SESSION.id },
        { label: "Order", value: ORDER.id },
        { label: "Error", value: "Error: verifyPaidSession: connection terminated" },
      ]),
    );
    const serialised = JSON.stringify(alert);
    expect(serialised).not.toContain("ana@example.com");
    expect(serialised).not.toContain("Ana Silva");
  });

  it("leaves the order out when the reference is not an order id", async () => {
    constructEvent.mockReturnValue({
      id: "evt_1QrecordFAIL9",
      type: "checkout.session.completed",
      livemode: false,
      data: { object: { ...SESSION, client_reference_id: "not-an-order" } },
    });
    settleVerifiedSession.mockRejectedValue(new Error("boom"));
    verifyPaidSession.mockResolvedValue({ ok: true, verified: { order: ORDER } });

    const res = await POST(webhook());

    expect(res.status).toBe(500);
    const [alert] = await alertsAfterResponse();
    expect(alert.link).toBeUndefined();
    expect(alert.key).toBe("record_failed");
    expect(alert.failOpen).toBeUndefined();
    expect(alert.facts).toEqual(expect.arrayContaining([{ label: "Order", value: "Not given" }]));
  });

  it("schedules nothing on the answers that are not refusals", async () => {
    verifyPaidSession.mockResolvedValue({ ok: true, verified: { order: ORDER } });
    await POST(webhook());

    verifyPaidSession.mockResolvedValue({ ok: false, reason: "Payment not completed." });
    await POST(webhook());

    constructEvent.mockReturnValue({ type: "checkout.session.completed", livemode: true, data: { object: SESSION } });
    expect(await (await POST(webhook())).json()).toEqual({ received: true, ignored: "mode mismatch" });

    constructEvent.mockReturnValue({ type: "customer.created", livemode: false, data: { object: {} } });
    expect(await (await POST(webhook())).json()).toEqual({ received: true });

    expect(scheduled).toHaveLength(0);
    expect(sendOpsAlert).not.toHaveBeenCalled();
  });
});
