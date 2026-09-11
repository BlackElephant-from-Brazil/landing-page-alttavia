import type Stripe from "stripe";

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
 */

export const runtime = "nodejs";

const PAID_EVENTS = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json(
      { error: "STRIPE_WEBHOOK_SECRET is not set. Add it to the environment and redeploy." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.warn("POST /api/stripe/webhook: signature verification failed:", err);
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
      return Response.json({ received: true, ignored: result.reason });
    }
    await settleVerifiedSession(result.verified);
    return Response.json({ received: true });
  } catch (err) {
    console.error(`POST /api/stripe/webhook: ${event.type} ${session.id} failed:`, err);
    return Response.json({ error: "Could not record the payment." }, { status: 500 });
  }
}
