import type Stripe from "stripe";

import { markOrderPaid } from "@/lib/orders/mark-paid";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserServiceRow } from "@/lib/db/types";
import { getStripe } from "./client";

/**
 * Turns a Checkout Session into a paid order, or explains why not. Contract
 * section 8.
 *
 * Two callers share the verification: the dashboard, when the buyer lands on
 * `?session_id=`, and the webhook, when Stripe reports the session. Both
 * check the same things against the order row (paid, ours, right amount,
 * right currency); only the dashboard also knows which user is asking and
 * requires the order to be theirs.
 *
 * `confirmCheckoutSession` never throws. A bad, foreign or unpaid session is
 * logged and reported as `{ ok: false }`, because the page that calls it is
 * rendering for a person who may simply have an old link.
 *
 * The first time an order is paid, `settleVerifiedSession` also sends the
 * payment emails (client and team), best effort. Nothing here imports the
 * service agreement code: the client asks for the agreement after paying.
 */

export type ConfirmResult = { ok: true; userServiceId: string } | { ok: false; reason: string };

export type VerifiedSession = {
  order: UserServiceRow;
  sessionId: string;
  paymentIntentId: string | null;
  amountCents: number;
  currency: string;
};

export type VerifyResult =
  | { ok: true; verified: VerifiedSession }
  | {
      ok: false;
      reason: string;
      /**
       * Set when the session paid a known order, for the wrong amount or in
       * the wrong currency: money was taken and the order stays unpaid, so
       * the webhook tells the team (src/lib/orders/notify.ts).
       */
      mismatchedOrder?: UserServiceRow;
    };

export const AMOUNT_MISMATCH = "Paid amount does not match the order.";
export const CURRENCY_MISMATCH = "Paid currency does not match the order.";

const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;

/**
 * Checks a session against its order without writing anything. Throws only
 * on a database error, so the webhook can answer 500 and let Stripe retry.
 */
export async function verifyPaidSession(
  session: Stripe.Checkout.Session,
  expectedUserId?: string,
): Promise<VerifyResult> {
  if (session.payment_status !== "paid") {
    return { ok: false, reason: "Payment not completed." };
  }

  const reference = session.client_reference_id;
  if (!reference) {
    return { ok: false, reason: "Session carries no order reference." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from("user_services").select("*").eq("id", reference).maybeSingle();
  if (error) throw new Error(`verifyPaidSession: ${error.message}`);
  const order = data as UserServiceRow | null;
  if (!order) {
    return { ok: false, reason: "Order not found." };
  }
  if (expectedUserId && order.user_id !== expectedUserId) {
    return { ok: false, reason: "This order belongs to another account." };
  }

  const amountCents = session.amount_total;
  if (amountCents === null || amountCents !== order.total_cents) {
    return { ok: false, reason: AMOUNT_MISMATCH, mismatchedOrder: order };
  }
  const currency = session.currency ?? "";
  if (currency.toLowerCase() !== order.currency.toLowerCase()) {
    return { ok: false, reason: CURRENCY_MISMATCH, mismatchedOrder: order };
  }

  const intent = session.payment_intent;
  const paymentIntentId = typeof intent === "string" ? intent : (intent?.id ?? null);

  return {
    ok: true,
    verified: { order, sessionId: session.id, paymentIntentId, amountCents, currency },
  };
}

/**
 * Records a verified session on its order. Throws on a database error.
 *
 * The one funnel the dashboard return and the webhook share, so it is also
 * where the payment emails start: "Payment received" to the client and "New
 * paid order" to the team, only when `markOrderPaid` answers `changed`. That
 * flag comes from a conditional update, so of the two callers exactly one
 * sends and a repeat sends nothing. The emails are best effort and never
 * throw (src/lib/orders/notify.ts): a failed send cannot undo the payment or
 * turn the webhook into a 500. `origin` builds their links when
 * NEXT_PUBLIC_SITE_URL is empty; absent, the request's headers are read.
 */
export async function settleVerifiedSession(
  verified: VerifiedSession,
  opts: { origin?: string | null } = {},
): Promise<ConfirmResult> {
  const paid = await markOrderPaid(verified.order.id, {
    sessionId: verified.sessionId,
    paymentIntentId: verified.paymentIntentId,
    amountCents: verified.amountCents,
    currency: verified.currency,
  });
  if (paid.changed) {
    try {
      // Loaded on the first payment only, so the dashboard page that imports
      // this module stays free of the email code (src/lib/contracts/state.test.ts
      // guards its import graph). A failed load is caught like a failed send.
      const { notifyOrderPaid } = await import("@/lib/orders/notify");
      await notifyOrderPaid(verified.order, opts);
    } catch (err) {
      console.error(`settleVerifiedSession: payment emails for ${verified.order.id} failed:`, err);
    }
  }
  return { ok: true, userServiceId: verified.order.id };
}

/**
 * The dashboard's entry point: the session id from the success URL and the
 * signed in user. Never throws.
 */
export async function confirmCheckoutSession(sessionId: string, userId: string): Promise<ConfirmResult> {
  if (!SESSION_ID.test(sessionId)) {
    return { ok: false, reason: "Invalid session reference." };
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error(`confirmCheckoutSession: could not retrieve ${sessionId}:`, err);
    return { ok: false, reason: "Session not found." };
  }

  try {
    const result = await verifyPaidSession(session, userId);
    if (!result.ok) {
      console.warn(`confirmCheckoutSession: ${sessionId} rejected for user ${userId}: ${result.reason}`);
      return { ok: false, reason: result.reason };
    }
    return await settleVerifiedSession(result.verified);
  } catch (err) {
    console.error(`confirmCheckoutSession: ${sessionId} failed:`, err);
    return { ok: false, reason: "The payment could not be recorded. Please refresh in a moment." };
  }
}
