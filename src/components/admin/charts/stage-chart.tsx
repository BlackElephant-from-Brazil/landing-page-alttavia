import type { Overview } from "@/lib/db/types";

import { formatCount } from "../lib/format";
import { DonutChart } from "./donut-chart";

/**
 * Orders not yet complete, by the stage they sit on, as a donut in
 * lifecycle order: the legend reads top to bottom as the stages run, and
 * a stage with nothing on it stays listed, greyed out. Server component;
 * the donut inside is the client island.
 */
export function StageChart({ data }: { data: Overview["ordersByStage"] }) {
  const total = data.reduce((sum, r) => sum + r.count, 0);
  return (
    <DonutChart
      id="stage-chart"
      title="Orders by stage"
      description="Every order not yet complete, on the stage it is on today. Unpaid orders sit on the first stage."
      items={data.map((row) => ({ key: row.stageKey, label: row.label, count: row.count }))}
      unit="orders"
      headers={["Stage", "Orders"]}
      emptyText={data.length === 0 ? "No stages configured yet." : "No order in progress."}
      footer={total > 0 ? `${formatCount(total)} in progress in total.` : undefined}
    />
  );
}
