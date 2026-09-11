import type { Overview } from "@/lib/db/types";

import { formatCount, formatEuro } from "../lib/format";
import { AXIS_FONT, AXIS_TEXT, ChartFrame, EmptyChart, GRID, HiddenTable, LABEL_FONT, LABEL_TEXT, MARK, niceMax } from "./chart-frame";

/**
 * Orders paid in the range, by service, as small horizontal bars in
 * catalogue order. The count is the bar; the revenue sits in the tooltip
 * and the hidden table rather than on a second scale.
 */

const WIDTH = 560;
const LABEL_WIDTH = 190;
const PAD_RIGHT = 40;
const ROW = 30;
const BAR = 16;
const TOP = 6;

export function ServiceChart({ data }: { data: Overview["ordersByService"] }) {
  const rows = data;
  const max = niceMax(Math.max(0, ...rows.map((r) => r.count)));
  const plotWidth = WIDTH - LABEL_WIDTH - PAD_RIGHT;
  const height = TOP + rows.length * ROW + 4;

  return (
    <ChartFrame id="service-chart" title="Orders by service" description="Orders paid in the range, by what was bought.">
      {rows.length === 0 ? (
        <EmptyChart>No paid orders in this range.</EmptyChart>
      ) : (
        <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Orders by service" className="h-auto w-full">
          <line x1={LABEL_WIDTH} x2={LABEL_WIDTH} y1={TOP} y2={height - 4} stroke={GRID} strokeWidth={1} />
          {rows.map((row, i) => {
            const y = TOP + i * ROW + (ROW - BAR) / 2;
            const width = (row.count / max) * plotWidth;
            const r = Math.min(4, width);
            const path =
              width <= 0
                ? ""
                : `M${LABEL_WIDTH},${y} H${LABEL_WIDTH + width - r} Q${LABEL_WIDTH + width},${y} ${LABEL_WIDTH + width},${y + r} V${y + BAR - r} Q${LABEL_WIDTH + width},${y + BAR} ${LABEL_WIDTH + width - r},${y + BAR} H${LABEL_WIDTH} Z`;
            return (
              <g key={row.slug}>
                <text
                  x={LABEL_WIDTH - 10}
                  y={y + BAR / 2 + 4}
                  textAnchor="end"
                  fill={AXIS_TEXT}
                  style={{ font: AXIS_FONT }}
                >
                  {row.name}
                </text>
                {path && (
                  <path d={path} fill={MARK}>
                    <title>{`${row.name}: ${formatCount(row.count)}, ${formatEuro(row.revenueCents)}`}</title>
                  </path>
                )}
                <text
                  x={LABEL_WIDTH + width + 8}
                  y={y + BAR / 2 + 4}
                  fill={LABEL_TEXT}
                  style={{ font: LABEL_FONT, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
                >
                  {formatCount(row.count)}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      <HiddenTable
        caption="Orders by service"
        headers={["Service", "Orders", "Revenue"]}
        rows={rows.map((r) => [r.name, r.count, formatEuro(r.revenueCents)])}
      />
    </ChartFrame>
  );
}
