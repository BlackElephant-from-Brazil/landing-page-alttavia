import type { Overview } from "@/lib/db/types";

import { formatEuro } from "../lib/format";
import { DonutChart } from "./donut-chart";

/**
 * Orders paid in the range, by service, as a donut in catalogue order. The
 * count is the slice; the revenue sits in the hidden table rather than on
 * a second scale. A service that sold nothing stays in the legend, greyed
 * out. Server component; the donut inside is the client island.
 */
export function ServiceChart({ data }: { data: Overview["ordersByService"] }) {
  return (
    <DonutChart
      id="service-chart"
      title="Orders by service"
      description="Orders paid in the range, by what was bought."
      items={data.map((row) => ({ key: row.slug, label: row.name, count: row.count, extra: [formatEuro(row.revenueCents)] }))}
      unit="orders"
      headers={["Service", "Orders", "Revenue"]}
      emptyText="No paid orders in this range."
    />
  );
}
