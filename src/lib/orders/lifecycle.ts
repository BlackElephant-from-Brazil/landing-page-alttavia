import { createAdminClient } from "@/lib/supabase/admin";
import type { ServiceStageRow, UserServiceRow } from "@/lib/db/types";

/**
 * Moves an order through its service's lifecycle. Contract
 * (docs/admin-contract.md) section 4.
 *
 *   advanceStage(orderId, actorId, { direction: "forward" })   next position
 *   advanceStage(orderId, actorId, { direction: "back" })      previous position
 *   advanceStage(orderId, actorId, { stageKey: "nif_ready" })  jump
 *
 * Stages come from `service_stages` in `position` order. Landing on the
 * terminal stage sets `completed_at` (kept if already set); landing anywhere
 * else clears it. Every move writes a `user_service_events` row with the
 * actor. Jumping to the stage the order is already on writes nothing.
 *
 * `firstCompletion` says whether this move is the first time the order
 * reaches its terminal stage, which is when the route emails the client.
 * No column records it: the answer is whether `user_service_events` already
 * holds a row whose `to_stage` is the terminal key, read before this move's
 * own row is written. A document review on the terminal stage writes such a
 * row too (from and to are the same), and it can only exist once the order
 * got there, so it counts the same way. Back to an earlier stage and forward
 * again is therefore never a first time.
 *
 * The update carries the stage the order was read at, so two admins moving
 * the same order at once cannot both win: the second sees no row and gets a
 * StageError to refresh. Stage transitions are the admin's call, documents
 * approved or not; the route shows the warning, this function does not
 * block. The one hard rule: an unpaid order (`paid_at` null) cannot leave
 * the first stage, so a move past it answers 409 "unpaid".
 *
 * Errors are StageError with an http status and a one line message under
 * the house rules, so the route can answer with them as they are.
 */

export type StageMove = { direction: "forward" | "back" } | { stageKey: string };

export type StageResult = {
  /** The stage the order is on after the call. */
  stageKey: string;
  /** True when that stage is the terminal one and `completed_at` is set. */
  completed: boolean;
  /**
   * True only when this call moved the order onto its terminal stage and no
   * earlier event had taken it there. False for every other call, including
   * one that writes nothing.
   */
  firstCompletion: boolean;
};

export type StageErrorCode =
  | "order_not_found"
  | "no_stages"
  | "unknown_stage"
  | "no_next_stage"
  | "no_previous_stage"
  | "unpaid"
  | "stale";

export class StageError extends Error {
  readonly code: StageErrorCode;
  readonly status: 404 | 409 | 422;

  constructor(code: StageErrorCode, status: 404 | 409 | 422, message: string) {
    super(message);
    this.name = "StageError";
    this.code = code;
    this.status = status;
  }
}

type OrderState = Pick<UserServiceRow, "id" | "service_id" | "stage_key" | "completed_at" | "paid_at">;

function pickTarget(stages: ServiceStageRow[], current: ServiceStageRow | undefined, move: StageMove): ServiceStageRow {
  if ("stageKey" in move) {
    const target = stages.find((s) => s.key === move.stageKey);
    if (!target) throw new StageError("unknown_stage", 422, "That stage does not exist for this service.");
    return target;
  }

  // An order on a stage its service no longer has (edited after the order)
  // is treated as sitting before the first stage, so "forward" repairs it.
  const index = current ? stages.indexOf(current) : -1;
  if (move.direction === "forward") {
    const target = stages[index + 1];
    if (!target) throw new StageError("no_next_stage", 409, "This order is already at its last stage.");
    return target;
  }
  const target = index > 0 ? stages[index - 1] : undefined;
  if (!target) throw new StageError("no_previous_stage", 409, "This order is already at its first stage.");
  return target;
}

export async function advanceStage(orderId: string, actorId: string, move: StageMove): Promise<StageResult> {
  const admin = createAdminClient();

  const { data: orderData, error: orderError } = await admin
    .from("user_services")
    .select("id, service_id, stage_key, completed_at, paid_at")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) throw new Error(`advanceStage: ${orderError.message}`);
  const order = orderData as OrderState | null;
  if (!order) throw new StageError("order_not_found", 404, "Order not found.");

  const { data: stageData, error: stageError } = await admin
    .from("service_stages")
    .select("*")
    .eq("service_id", order.service_id)
    .order("position", { ascending: true });
  if (stageError) throw new Error(`advanceStage: ${stageError.message}`);
  const stages = (stageData ?? []) as ServiceStageRow[];
  if (stages.length === 0) throw new StageError("no_stages", 422, "This service has no stages yet.");

  const current = stages.find((s) => s.key === order.stage_key);
  const target = pickTarget(stages, current, move);

  // Payment moves an order off the first stage; nothing else does.
  if (!order.paid_at && target.position > stages[0].position) {
    throw new StageError("unpaid", 409, "Payment first.");
  }

  if (target.key === order.stage_key) {
    return { stageKey: target.key, completed: target.is_terminal && order.completed_at !== null, firstCompletion: false };
  }

  // Read before the update and the insert below, so this move's own event
  // row can never be mistaken for an earlier arrival.
  let reachedBefore = false;
  if (target.is_terminal) {
    const { data: earlier, error: earlierError } = await admin
      .from("user_service_events")
      .select("id")
      .eq("user_service_id", orderId)
      .eq("to_stage", target.key)
      .limit(1);
    if (earlierError) throw new Error(`advanceStage: ${earlierError.message}`);
    reachedBefore = (earlier ?? []).length > 0;
  }

  const completedAt = target.is_terminal ? (order.completed_at ?? new Date().toISOString()) : null;

  const { data: updated, error: updateError } = await admin
    .from("user_services")
    .update({ stage_key: target.key, completed_at: completedAt })
    .eq("id", orderId)
    .eq("stage_key", order.stage_key)
    .select("id");
  if (updateError) throw new Error(`advanceStage: ${updateError.message}`);
  if (!updated || updated.length === 0) {
    throw new StageError("stale", 409, "This order changed a moment ago. Refresh and try again.");
  }

  const { error: eventError } = await admin.from("user_service_events").insert({
    user_service_id: orderId,
    from_stage: order.stage_key,
    to_stage: target.key,
    actor_id: actorId,
  });
  if (eventError) {
    // The stage is moved; the audit row is worth a log line, not a retry
    // that would find the order already on the new stage.
    console.error(`advanceStage: event insert failed for ${orderId}: ${eventError.message}`);
  }

  return {
    stageKey: target.key,
    completed: completedAt !== null,
    firstCompletion: target.is_terminal && !reachedBefore,
  };
}
