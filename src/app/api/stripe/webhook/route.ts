import { after } from "next/server";
import type Stripe from "stripe";

import { sendOpsAlert, type OpsAlertInput } from "@/lib/ops/alerts";
import { notifyPaymentMismatch } from "@/lib/orders/notify";
import { getStripe, isLiveMode } from "@/lib/stripe/client";
import { settleVerifiedSession, verifyPaidSession } from "@/lib/stripe/confirm";

/**
 * POST /api/stripe/webhook. Contract section 8.
 *
 * The second way an order gets marked paid, for the buyer who closes the tab
 * before Stripe sends them back. The raw body is verified against
 * STRIPE_WEBHOOK_SECRET; without that variable the endpoint answers 503 so a
 * misconfigured deploy is visible in Stripe's dashboard rather than silent.
 *
 * `checkout.session.completed` is the event for a card payment. A delayed
 * method (bank transfer, for instance) completes the session first and
 * reports the money later as `checkout.session.async_payment_succeeded`;
 * both are handled the same way, and the `payment_status` check inside
 * `verifyPaidSession` makes the first one a no-op until the money is there.
 *
 * Status codes drive Stripe's retries: 200 means done or deliberately
 * ignored (a session that fails verification will never pass, so retrying
 * is pointless); 500 means a database hiccup and asks for another attempt.
 *
 * One ignored case is not quiet: a paid session that names a known order
 * but paid another amount or currency (a Payment Link or price id that
 * costs something else). The money was taken and the order stays unpaid,
 * so the team inbox gets "Paid amount does not match the order" (best
 * effort, never throws, src/lib/orders/notify.ts) and the answer stays 200.
 *
 * Three refusals also email an operations alert (src/lib/ops/alerts.ts, to
 * ALERTS_TO, production builds only): the missing secret (503), a signature
 * that fails verification (400), and a payment that could not be recorded
 * (500), the last with the Stripe event id and type, the session id and the
 * order id from `client_reference_id`, never an email address or a name.
 * The alert runs in after(), once the answer has gone out; the answers
 * themselves are the same as before the alerts existed.
 *
 * Anyone on the internet can POST here, so the two refusals a stranger can
 * set off are held for 6 hours per environment instead of 30 minutes, and
 * are logged only when the shared throttle (`public.ops_alerts`) cannot be
 * read (`failOpen: false`). A failed signature alerts only when the header
 * has Stripe's own shape (`t=<unix time>,v1=<64 hex>`) with a timestamp
 * inside Stripe's five minute tolerance, which a Stripe event signed with
 * another secret always has; anything else (no header, a malformed one, a
 * stale one) is most likely a scanner or a replay and is logged only. A
 * payment that could not be recorded is keyed by its order, so two orders
 * failing in the same half hour each get their email.
 *
 * The log line of a failed verification carries the error's name and
 * message only: Stripe's error object also holds the whole payload, with the
 * buyer's email and address, and the header.
 */

export const runtime = "nodejs";

const PAID_EVENTS = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

const ROUTE = "/api/stripe/webhook";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENT_ID = /^evt_[A-Za-z0-9]{8,64}$/;
const EVENT_TYPE = /^[a-z_]+(?:\.[a-z_]+){1,4}$/;

/** How long a refusal a stranger can set off is held per environment. */
const STRANGER_ALERT_WINDOW_MS = 6 * 60 * 60 * 1000;
/** Stripe's own default tolerance for a signature's timestamp. */
const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * True when a stripe-signature header has Stripe's shape: a `t=` Unix time
 * within the tolerance of now, and at least one `v1=` of 64 hex digits.
 * Says nothing about whether it verifies; it only tells a Stripe event
 * signed with another secret from a scanner's or a replay's header.
 */
function stripeShapedSignature(header: string, now: number = Date.now()): boolean {
  let timestamp: number | null = null;
  let hasV1 = false;
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name === "t" && /^\d{1,12}$/.test(value)) timestamp = Number(value) * 1000;
    if (name === "v1" && /^[0-9a-f]{64}$/i.test(value)) hasV1 = true;
  }
  return hasV1 && timestamp !== null && Math.abs(now - timestamp) <= SIGNATURE_TOLERANCE_MS;
}

/** Runs the alert after the answer has gone out. Never throws, never changes the answer. */
function alertAfterResponse(alert: OpsAlertInput): void {
  try {
    after(() => sendOpsAlert(alert));
  } catch (err) {
    // after() refuses outside a request scope; send without waiting instead.
    console.warn(`POST ${ROUTE}: could not schedule the alert after the response:`, err instanceof Error ? err.message : err);
    void sendOpsAlert(alert);
  }
}

/**
 * The event id and type a refused request claims, read from the body that
 * failed verification. Unverified, so only values of Stripe's own shape are
 * kept: they tell a real event signed with another secret (a rotated or
 * mistyped STRIPE_WEBHOOK_SECRET) from a stranger's request.
 */
function claimedEvent(payload: string): { id: string; type: string } {
  try {
    const body = JSON.parse(payload) as { id?: unknown; type?: unknown } | null;
    return {
      id: typeof body?.id === "string" && EVENT_ID.test(body.id) ? body.id : "Not readable",
      type: typeof body?.type === "string" && EVENT_TYPE.test(body.type) ? body.type : "Not readable",
    };
  } catch {
    return { id: "Not readable", type: "Not readable" };
  }
}

function errorLine(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return typeof err === "string" ? err : "Unknown error";
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    alertAfterResponse({
      kind: "webhook",
      key: "missing_secret",
      windowMs: STRANGER_ALERT_WINDOW_MS,
      failOpen: false,
      subject: "Stripe webhook refused: STRIPE_WEBHOOK_SECRET is not set",
      facts: [
        { label: "Route", value: ROUTE },
        { label: "Answer", value: "503" },
        { label: "What to do", value: "Set STRIPE_WEBHOOK_SECRET in the Netlify environment and redeploy." },
      ],
    });
    return Response.json(
      { error: "STRIPE_WEBHOOK_SECRET is not set. Add it to the environment and redeploy." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    console.warn(`POST ${ROUTE}: request without a stripe-signature header refused`);
    return Response.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    // The name and message only: Stripe's error object holds the payload and the header.
    console.warn(`POST ${ROUTE}: signature verification failed: ${errorLine(err)}`);
    if (!stripeShapedSignature(signature)) {
      console.warn(`POST ${ROUTE}: the stripe-signature header is not Stripe's, or its time is stale; no alert`);
      return Response.json({ error: "Invalid signature." }, { status: 400 });
    }
    const claimed = claimedEvent(payload);
    alertAfterResponse({
      kind: "webhook",
      key: "invalid_signature",
      windowMs: STRANGER_ALERT_WINDOW_MS,
      failOpen: false,
      subject: "Stripe webhook refused: the signature did not verify",
      facts: [
        { label: "Route", value: ROUTE },
        { label: "Answer", value: "400" },
        { label: "Claimed event", value: claimed.id },
        { label: "Claimed type", value: claimed.type },
        { label: "Error", value: errorLine(err) },
        {
          label: "What to check",
          value: "That STRIPE_WEBHOOK_SECRET is the signing secret of this endpoint, in the same mode as STRIPE_SECRET_KEY.",
        },
      ],
    });
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  // A test event reaching a live deploy (or the reverse) is signed correctly
  // but belongs to the other world; it must never touch an order here.
  if (event.livemode !== isLiveMode()) {
    return Response.json({ received: true, ignored: "mode mismatch" });
  }

  if (!PAID_EVENTS.has(event.type)) {
    return Response.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  try {
    const result = await verifyPaidSession(session);
    if (!result.ok) {
      console.warn(`POST /api/stripe/webhook: ${event.type} ${session.id} ignored: ${result.reason}`);
      if (result.mismatchedOrder) {
        await notifyPaymentMismatch({
          order: result.mismatchedOrder,
          sessionId: session.id,
          paidCents: session.amount_total,
          paidCurrency: session.currency,
        });
      }
      return Response.json({ received: true, ignored: result.reason });
    }
    await settleVerifiedSession(result.verified);
    return Response.json({ received: true });
  } catch (err) {
    console.error(`POST /api/stripe/webhook: ${event.type} ${session.id} failed:`, err);
    const orderId = typeof session.client_reference_id === "string" ? session.client_reference_id : "";
    const knownOrder = UUID.test(orderId);
    alertAfterResponse({
      kind: "webhook",
      key: knownOrder ? `record_failed:${orderId}` : "record_failed",
      subject: "Stripe webhook: a payment could not be recorded",
      facts: [
        { label: "Route", value: ROUTE },
        { label: "Answer", value: "500, so Stripe sends the event again later" },
        { label: "Stripe event", value: typeof event.id === "string" ? event.id : "Not given" },
        { label: "Event type", value: event.type },
        { label: "Stripe session", value: typeof session.id === "string" ? session.id : "Not given" },
        { label: "Order", value: knownOrder ? orderId : "Not given" },
        { label: "Error", value: errorLine(err) },
      ],
      stack: err instanceof Error ? err.stack : undefined,
      ...(knownOrder ? { link: { label: "Open the order", path: `/admin/orders?order=${orderId}` } } : {}),
    });
    return Response.json({ error: "Could not record the payment." }, { status: 500 });
  }
}
