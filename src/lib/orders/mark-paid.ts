import { createAdminClient } from "@/lib/supabase/admin";
import type { ServiceStageRow, UserServiceRow } from "@/lib/db/types";

/**
 * Records a payment on an order. Contract section 8.
 *
 * Called from two places that can race: the dashboard confirming the session
 * the buyer came back with, and the Stripe webhook. It is idempotent at the
 * database, not only in memory: the update carries `paid_at is null`, so of
 * two concurrent calls exactly one writes and the other sees no row and
 * returns without changes. The `stripe_checkout_session_id` column is unique,
 * so a second session id could never overwrite the first.
 *
 * The caller has already verified the amount and currency against Stripe.
 * They are checked once more here, against the order, so this function can
 * never be talked into marking an order paid for less than its total.
 */

export type MarkPaidInput = {
  sessionId: string;
  paymentIntentId: string | null;
  amountCents: number;
  currency: string;
};

export type MarkPaidResult = {
  /** False when the order was already paid and nothing was written. */
  changed: boolean;
  /** The stage the order is in after the call. */
  stageKey: string;
};

const PAID_NOTE = "Paid through Stripe";

export async function markOrderPaid(userServiceId: string, input: MarkPaidInput): Promise<MarkPaidResult> {
  const admin = createAdminClient();

  const { data: order, error: orderError } = await admin
    .from("user_services")
    .select("id, service_id, stage_key, total_cents, currency, paid_at, stripe_checkout_session_id")
    .eq("id", userServiceId)
    .maybeSingle();
  if (orderError) throw new Error(`markOrderPaid: ${orderError.message}`);
  if (!order) throw new Error(`markOrderPaid: order ${userServiceId} not found`);

  const current = order as Pick<
    UserServiceRow,
    "id" | "service_id" | "stage_key" | "total_cents" | "currency" | "paid_at" | "stripe_checkout_session_id"
  >;

  if (current.paid_at) {
    if (input.sessionId !== current.stripe_checkout_session_id) {
      // Money arrived twice for one order. Nothing is written; someone has
      // to refund the second payment by hand, so it is logged loudly.
      console.error("second payment on a paid order, refund needed", {
        userServiceId,
        paidSession: current.stripe_checkout_session_id,
        newSession: input.sessionId,
      });
    }
    return { changed: false, stageKey: current.stage_key };
  }

  if (input.amountCents !== current.total_cents) {
    throw new Error(
      `markOrderPaid: amount ${input.amountCents} does not match order total ${current.total_cents}`,
    );
  }
  if (input.currency.toLowerCase() !== current.currency.toLowerCase()) {
    throw new Error(`markOrderPaid: currency ${input.currency} does not match order currency ${current.currency}`);
  }

  // Payment moves the order to the second stage of its service, whatever that
  // stage is called. Every seeded service has one; should a service ever lack
  // it, the payment is still recorded and the stage stays put, because money
  // taken and not recorded is the worse outcome.
  const { data: stage, error: stageError } = await admin
    .from("service_stages")
    .select("key")
    .eq("service_id", current.service_id)
    .eq("position", 2)
    .maybeSingle();
  if (stageError) throw new Error(`markOrderPaid: ${stageError.message}`);
  const nextStage = (stage as Pick<ServiceStageRow, "key"> | null)?.key ?? current.stage_key;
  if (!stage) {
    console.error(`markOrderPaid: service ${current.service_id} has no stage at position 2; stage left unchanged`);
  }

  const paidAt = new Date().toISOString();
  const { data: updated, error: updateError } = await admin
    .from("user_services")
    .update({
      paid_at: paidAt,
      stripe_checkout_session_id: input.sessionId,
      stripe_payment_intent_id: input.paymentIntentId,
      stage_key: nextStage,
    })
    .eq("id", userServiceId)
    .is("paid_at", null)
    .select("id");
  if (updateError) throw new Error(`markOrderPaid: ${updateError.message}`);

  if (!updated || updated.length === 0) {
    // The other caller got there first between our read and our write.
    return { changed: false, stageKey: nextStage };
  }

  const { error: eventError } = await admin.from("user_service_events").insert({
    user_service_id: userServiceId,
    from_stage: current.stage_key,
    to_stage: nextStage,
    note: PAID_NOTE,
  });
  if (eventError) {
    // The payment itself is recorded; a missing audit row is worth a log line,
    // not a retry that would find the order already paid.
    console.error(`markOrderPaid: event insert failed for ${userServiceId}: ${eventError.message}`);
  }

  return { changed: true, stageKey: nextStage };
}
