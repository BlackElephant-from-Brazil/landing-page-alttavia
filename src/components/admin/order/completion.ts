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

/**
 * What the client does not have yet when the order is about to be marked
 * complete: the deliverables from the service's list with no file sent, and
 * the report when it is empty. The completion email tells the client their
 * documents and report are ready, so the question before completing names
 * the gaps. Null when nothing is missing.
 */
export function completionGaps(missingDeliverables: readonly string[], hasReport: boolean): string | null {
  const items = [...missingDeliverables];
  if (!hasReport) items.push("the report for the client");
  if (items.length === 0) return null;
  const list = items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  return `Not sent yet: ${list}.`;
}
