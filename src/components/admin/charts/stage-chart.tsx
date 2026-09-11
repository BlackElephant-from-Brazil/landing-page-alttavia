import type { Overview } from "@/lib/db/types";

import { formatCount } from "../lib/format";
import { AXIS_FONT, AXIS_TEXT, ChartFrame, EmptyChart, GRID, HiddenTable, LABEL_FONT, LABEL_TEXT, MARK, niceMax } from "./chart-frame";

/**
 * Orders not yet complete, by the stage they sit on, as horizontal bars in
 * lifecycle order with the label on the left and the count at the tip.
 * One series, one hue; the stage order is the story, so nothing is
 * coloured by size.
 */

const WIDTH = 560;
const LABEL_WIDTH = 150;
const PAD_RIGHT = 40;
const ROW = 30;
const BAR = 16;
const TOP = 6;

export function StageChart({ data }: { data: Overview["ordersByStage"] }) {
  const rows = data;
  const max = niceMax(Math.max(0, ...rows.map((r) => r.count)));
  const plotWidth = WIDTH - LABEL_WIDTH - PAD_RIGHT;
  const height = TOP + rows.length * ROW + 4;
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <ChartFrame
      id="stage-chart"
      title="Orders by stage"
      description="Every order not yet complete, on the stage it is on today. Unpaid orders sit on the first stage."
    >
      {rows.length === 0 ? (
        <EmptyChart>No stages configured yet.</EmptyChart>
      ) : (
        <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Orders by stage" className="h-auto w-full">
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
              <g key={row.stageKey}>
                <text
                  x={LABEL_WIDTH - 10}
                  y={y + BAR / 2 + 4}
                  textAnchor="end"
                  fill={AXIS_TEXT}
                  style={{ font: AXIS_FONT }}
                >
                  {row.label}
                </text>
                {path && (
                  <path d={path} fill={MARK}>
                    <title>{`${row.label}: ${formatCount(row.count)}`}</title>
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

      <p className="mt-3 text-[0.8rem] text-navy-muted">{formatCount(total)} in progress in total.</p>

      <HiddenTable
        caption="Orders by stage"
        headers={["Stage", "Orders"]}
        rows={rows.map((r) => [r.label, r.count])}
      />
    </ChartFrame>
  );
}
