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
 *   - the move writes a `user_service_events` row saying who recorded it.
 *
 * What it does not do is touch `stripe_checkout_session_id`: that column is
 * unique and belongs to Stripe. An order paid here and later paid again
 * through Stripe would be caught by `markOrderPaid`, which sees `paid_at`
 * set and logs the second payment instead of writing it.
 *
 * The caller sends the emails (notifyOrderPaid) when this answers `changed`.
 */

export const MANUAL_PAYMENT_NOTE = "Paid outside the platform, recorded by the admin";

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

export async function recordManualPayment(admin: Db, orderId: string, actorId: string): Promise<ManualPaymentResult> {
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
    note: MANUAL_PAYMENT_NOTE,
    actor_id: actorId,
  });
  if (eventError) {
    // The payment is recorded; the audit row is worth a log line, not a
    // retry that would find the order already paid.
    console.error(`recordManualPayment: event insert failed for ${orderId}: ${eventError.message}`);
  }

  return { changed: true, stageKey: nextStage };
}
