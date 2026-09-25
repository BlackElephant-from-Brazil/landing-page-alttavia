import type { Db } from "@/lib/db/queries";
import type { UserServiceRow } from "@/lib/db/types";

import { MANUAL_PAYMENT_LIVE_NOTE } from "./manual-payment";

/**
 * Whether an order was paid with real money, which decides whether its
 * service agreement may carry the firm's signature and whether the client's
 * signed copy rides along to the team inbox (2026-09-25).
 *
 * Patrícia's digitised signature sits in the one bucket that production,
 * staging and local development share, and staging stays up for good as the
 * test environment, with Stripe in test mode. The three also share one
 * database. Without this rule anyone could sign up there, pay with a test
 * card, type any name and receive an agreement on the firm's letterhead with
 * her handwritten signature, or post a file of their choice into the firm's
 * inbox. So the signature goes only on an order that was paid for real,
 * every other agreement is marked as a specimen in its footer
 * (src/lib/contracts/generate.ts), and only a real order's signed copy is
 * attached to the team email (src/lib/orders/notify.ts).
 *
 *   isLiveOrder(order, paymentNotes?) -> true for an order paid with real money (pure)
 *   paidWithRealMoney(db, order)      -> the same, reading the order's payment record when the rule needs it
 *
 * How the order was paid is read from what the server wrote at the time,
 * never from the deploy that happens to render the PDF now:
 *
 *   cs_live_...   the Checkout Session on the order was created with a live
 *                 key: live.
 *   cs_test_...   a test card: never live.
 *   none          paid outside the platform (an admin recorded it,
 *                 src/lib/orders/manual-payment.ts): live only when the
 *                 order's events hold MANUAL_PAYMENT_LIVE_NOTE, the note
 *                 recordManualPayment writes when the deploy that recorded
 *                 the payment held a live Stripe key, which is production
 *                 alone. A payment recorded on staging or in development,
 *                 and any recorded before that note existed (2026-09-25),
 *                 is not live, whichever host prepares the agreement later.
 *
 * Changed 2026-09-25 (review): the rule for "none" used to be the key of the
 * deploy preparing the agreement. Staging and production share the
 * database, so a payment recorded on staging, during training say, got the
 * real signature the moment the agreement was first prepared on production.
 *
 * An unpaid order is never live. A read that fails throws: the caller
 * decides, and ensureContract lets it fail before anything is written.
 *
 * It lives with the orders, not with the contracts, although the agreement
 * is its first reader: it is a fact about a payment, and
 * src/lib/orders/notify.ts, which the payment path loads, reads it too.
 * The payment path must reach no contract code (src/lib/stripe/confirm.test.ts).
 * It imports nothing at run time but a constant of ./manual-payment.ts.
 */

export type LiveOrderInput = Pick<UserServiceRow, "paid_at" | "stripe_checkout_session_id">;

/** The prefix of a Checkout Session created with a live key. */
export const LIVE_SESSION_PREFIX = "cs_live_";

/**
 * The rule itself. `paymentNotes` are the notes of the order's events; only
 * an order paid outside the platform reads them.
 */
export function isLiveOrder(order: LiveOrderInput, paymentNotes: readonly (string | null | undefined)[] = []): boolean {
  if (!order.paid_at) return false;
  const session = order.stripe_checkout_session_id?.trim();
  if (session) return session.startsWith(LIVE_SESSION_PREFIX);
  return paymentNotes.includes(MANUAL_PAYMENT_LIVE_NOTE);
}

/** True when the rule depends on the admin's record: a paid order with no Checkout Session. */
export function needsPaymentRecord(order: LiveOrderInput): boolean {
  return !!order.paid_at && !order.stripe_checkout_session_id?.trim();
}

/**
 * isLiveOrder with the order's payment record read from the database, only
 * when the rule needs it. Throws when that read fails.
 */
export async function paidWithRealMoney(db: Db, order: LiveOrderInput & Pick<UserServiceRow, "id">): Promise<boolean> {
  if (!needsPaymentRecord(order)) return isLiveOrder(order);
  const { data, error } = await db
    .from("user_service_events")
    .select("note")
    .eq("user_service_id", order.id)
    .eq("note", MANUAL_PAYMENT_LIVE_NOTE);
  if (error) throw new Error(`paidWithRealMoney: ${error.message}`);
  const notes = ((data ?? []) as { note?: string | null }[]).map((row) => row.note);
  return isLiveOrder(order, notes);
}
