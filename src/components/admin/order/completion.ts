import type { ServiceStageRow, UserServiceEventRow, UserServiceRow } from "@/lib/db/types";

/**
 * Whether the order reached its terminal stage before, which is when the
 * stage route sends no completion email on the next move there. The same
 * test as `firstCompletion` in src/lib/orders/lifecycle.ts: an earlier
 * `user_service_events` row whose `to_stage` is a terminal key. A set
 * `completed_at` means the order sits on that stage now, which counts too.
 */
export function completedBefore(
  order: Pick<UserServiceRow, "completed_at">,
  stages: readonly Pick<ServiceStageRow, "key" | "is_terminal">[],
  events: readonly Pick<UserServiceEventRow, "to_stage">[],
): boolean {
  if (order.completed_at) return true;
  const terminal = new Set(stages.filter((s) => s.is_terminal).map((s) => s.key));
  return events.some((e) => terminal.has(e.to_stage));
}
