import type { Db } from "@/lib/db/queries";
import type { ServiceStageRow, UserServiceRow } from "@/lib/db/types";

/**
 * A payment that did not go through Stripe, recorded by an admin.
 *
 * Some clients pay the firm by transfer, or paid before the platform
 * existed. POST /api/admin/users/[id]/orders takes `paidOutside` for those:
 * the order is created and then marked paid here, with no Stripe ids, so the
 * dashboard shows it as paid and the documents can start.
 *
 * It follows src/lib/orders/mark-paid.ts as closely as it can:
 *
 *   - payment moves the order to the second stage of its service;
 *   - the update carries `paid_at is null`, so an order that was paid a
 *     moment ago by the webhook is not overwritten and the caller hears
 *     `changed: false` (which is also what keeps the emails to one per
 *     order, exactly as the Stripe funnel does);
 *   - the move writes a `user_service_events` row saying who recorded it,
 *     and where: its note is MANUAL_PAYMENT_LIVE_NOTE when the deploy that
 *     records it holds a live Stripe key (production), and
 *     MANUAL_PAYMENT_TEST_NOTE anywhere else (staging, development). The
 *     caller says which with `live`.
 *
 * Why the note says where (2026-09-25). Production and staging share one
 * database, and staging stays up as the test environment. A payment recorded
 * there, during training say, must never count as money the firm received:
 * ./live-payment.ts reads this note, and only this note, to
 * decide whether an order paid outside the platform gets the firm's
 * signature on its agreement and has its signed copy mailed to the team.
 * Rows written before this date carry the older note, MANUAL_PAYMENT_NOTE of
 * 2026-09-22 ("Paid outside the platform, recorded by the admin"), and read
 * as not live. When the event cannot be written the payment still stands,
 * but the order reads as not live until the row is added: a failure that
 * keeps the signature off, never one that puts it on.
 *
 * What it does not do is touch `stripe_checkout_session_id`: that column is
 * unique and belongs to Stripe. An order paid here and later paid again
 * through Stripe would be caught by `markOrderPaid`, which sees `paid_at`
 * set and logs the second payment instead of writing it.
 *
 * The caller sends the emails (notifyOrderPaid) when this answers `changed`.
 */

/** The note of a payment recorded on a deploy with a live Stripe key: production. */
export const MANUAL_PAYMENT_LIVE_NOTE = "Paid outside the platform, recorded by the admin on the live site";
/** The note of a payment recorded anywhere else: staging, development. */
export const MANUAL_PAYMENT_TEST_NOTE = "Paid outside the platform, recorded by the admin on the test site";

/** The event note for a payment recorded where the Stripe key is live, or not. Pure. */
export function manualPaymentNote(live: boolean): string {
  return live ? MANUAL_PAYMENT_LIVE_NOTE : MANUAL_PAYMENT_TEST_NOTE;
}

/**
 * The stage payment moves an order to: the stage at position 2, which every
 * seeded service has, else the second stage in position order, else null for
 * a service with fewer than two stages. Pure.
 */
export function secondStageKey(stages: readonly Pick<ServiceStageRow, "key" | "position">[]): string | null {
  const atTwo = stages.find((stage) => stage.position === 2);
  if (atTwo) return atTwo.key;
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  return ordered[1]?.key ?? null;
}

export type ManualPaymentResult = {
  /** False when the order was already paid and nothing was written. */
  changed: boolean;
  /** The stage the order is on after the call. */
  stageKey: string;
};

type OrderState = Pick<UserServiceRow, "id" | "service_id" | "stage_key" | "paid_at">;

/**
 * `live`: whether the deploy recording the payment holds a live Stripe key
 * (the route passes holdsLiveKey() from src/lib/stripe/client.ts). It only
 * picks the event note; see the header.
 */
export async function recordManualPayment(
  admin: Db,
  orderId: string,
  actorId: string,
  live: boolean,
): Promise<ManualPaymentResult> {
  const { data: orderData, error: orderError } = await admin
    .from("user_services")
    .select("id, service_id, stage_key, paid_at")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) throw new Error(`recordManualPayment: ${orderError.message}`);
  const order = orderData as OrderState | null;
  if (!order) throw new Error(`recordManualPayment: order ${orderId} not found`);
  if (order.paid_at) return { changed: false, stageKey: order.stage_key };

  const { data: stageData, error: stageError } = await admin
    .from("service_stages")
    .select("key, position")
    .eq("service_id", order.service_id)
    .order("position", { ascending: true });
  if (stageError) throw new Error(`recordManualPayment: ${stageError.message}`);
  const stages = (stageData ?? []) as Pick<ServiceStageRow, "key" | "position">[];

  // A service with no second stage keeps the order where it is: a payment
  // recorded and not moved is better than a payment not recorded.
  const nextStage = secondStageKey(stages) ?? order.stage_key;
  if (nextStage === order.stage_key && stages.length > 1) {
    console.error(`recordManualPayment: service ${order.service_id} has no second stage; stage left unchanged`);
  }

  const { data: updated, error: updateError } = await admin
    .from("user_services")
    .update({ paid_at: new Date().toISOString(), stage_key: nextStage })
    .eq("id", orderId)
    .is("paid_at", null)
    .select("id");
  if (updateError) throw new Error(`recordManualPayment: ${updateError.message}`);
  if (!updated || updated.length === 0) {
    // Stripe got there first between the read and the write.
    return { changed: false, stageKey: nextStage };
  }

  const { error: eventError } = await admin.from("user_service_events").insert({
    user_service_id: orderId,
    from_stage: order.stage_key,
    to_stage: nextStage,
    note: manualPaymentNote(live),
    actor_id: actorId,
  });
  if (eventError) {
    // The payment is recorded; the audit row is worth a log line, not a
    // retry that would find the order already paid. Without the row the
    // order reads as not paid with real money (see the header).
    console.error(
      `recordManualPayment: event insert failed for ${orderId} (${live ? "live" : "test"}); ` +
        `its agreement stays unsigned until the event is added: ${eventError.message}`,
    );
  }

  return { changed: true, stageKey: nextStage };
}
