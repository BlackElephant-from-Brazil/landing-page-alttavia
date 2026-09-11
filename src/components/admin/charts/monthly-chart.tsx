import type { Overview } from "@/lib/db/types";

import { formatCount, formatEuro, formatMonthLong, formatMonthShort } from "../lib/format";
import {
  AXIS_FONT,
  AXIS_TEXT,
  ChartFrame,
  GRID,
  HiddenTable,
  LABEL_FONT,
  LABEL_TEXT,
  MARK,
  MARK_ACCENT,
  SURFACE,
  compact,
  niceMax,
  ticks,
} from "./chart-frame";

/**
 * Paid orders and revenue over the last six months, as two small multiples
 * that share the month axis: columns for the count on top, a line with
 * markers for the euros below. Two axes on one plot would invent a
 * relation between the two scales, so each series keeps its own.
 *
 * Columns are capped at 24px, rounded at the data end and square at the
 * baseline; the line is 2px with 8px markers ringed in the surface colour.
 * Only the latest month is labelled directly; the ticks and the hidden
 * table carry the rest. Every column and marker has a native tooltip.
 */

const WIDTH = 560;
const PAD_LEFT = 44;
const PAD_RIGHT = 16;
const COUNT_HEIGHT = 120;
const REVENUE_HEIGHT = 120;
const GAP = 34;
const AXIS_BAND = 24;
const TOP = 14;
const HEIGHT = TOP + COUNT_HEIGHT + GAP + REVENUE_HEIGHT + AXIS_BAND;
const MAX_BAR = 24;

export function MonthlyChart({ data }: { data: Overview["ordersByMonth"] }) {
  const months = data.length;
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const slot = months > 0 ? plotWidth / months : plotWidth;
  const bar = Math.min(MAX_BAR, slot * 0.5);

  const countMax = niceMax(Math.max(0, ...data.map((d) => d.paid)));
  const revenueMax = niceMax(Math.max(0, ...data.map((d) => d.revenueCents / 100)));
  const countTicks = ticks(countMax, countMax <= 4 ? countMax : 4);
  const revenueTicks = ticks(revenueMax, 4);

  const countBase = TOP + COUNT_HEIGHT;
  const revenueTop = countBase + GAP;
  const revenueBase = revenueTop + REVENUE_HEIGHT;

  const x = (i: number) => PAD_LEFT + slot * i + slot / 2;
  const yCount = (v: number) => countBase - (v / countMax) * COUNT_HEIGHT;
  const yRevenue = (v: number) => revenueBase - (v / revenueMax) * REVENUE_HEIGHT;

  const last = data[months - 1];
  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${yRevenue(d.revenueCents / 100).toFixed(1)}`)
    .join(" ");

  return (
    <ChartFrame
      id="monthly-chart"
      title="Paid orders and revenue by month"
      description="The last six months, this one included. Orders on top, euros below."
    >
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Paid orders per month and revenue per month, last six months"
        className="h-auto w-full"
      >
        {/* Count panel */}
        <text x={PAD_LEFT} y={TOP - 4} fill={AXIS_TEXT} style={{ font: AXIS_FONT }}>
          Paid orders
        </text>
        {countTicks.map((tick) => (
          <g key={`c${tick}`}>
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yCount(tick)} y2={yCount(tick)} stroke={GRID} strokeWidth={1} />
            <text
              x={PAD_LEFT - 8}
              y={yCount(tick) + 3.5}
              textAnchor="end"
              fill={AXIS_TEXT}
              style={{ font: AXIS_FONT, fontVariantNumeric: "tabular-nums" }}
            >
              {compact(tick)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const height = (d.paid / countMax) * COUNT_HEIGHT;
          const top = countBase - height;
          const left = x(i) - bar / 2;
          const r = Math.min(4, height);
          const path =
            height <= 0
              ? ""
              : `M${left},${countBase} V${top + r} Q${left},${top} ${left + r},${top} H${left + bar - r} Q${left + bar},${top} ${left + bar},${top + r} V${countBase} Z`;
          return (
            <g key={d.month}>
              {path && (
                <path d={path} fill={MARK}>
                  <title>{`${formatMonthLong(d.month)}: ${formatCount(d.paid)} paid`}</title>
                </path>
              )}
              {i === months - 1 && d.paid > 0 && (
                <text
                  x={x(i)}
                  y={top - 5}
                  textAnchor="middle"
                  fill={LABEL_TEXT}
                  style={{ font: LABEL_FONT, fontWeight: 600 }}
                >
                  {formatCount(d.paid)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={countBase} y2={countBase} stroke={GRID} strokeWidth={1} />

        {/* Revenue panel */}
        <text x={PAD_LEFT} y={revenueTop - 4} fill={AXIS_TEXT} style={{ font: AXIS_FONT }}>
          Revenue, euros
        </text>
        {revenueTicks.map((tick) => (
          <g key={`r${tick}`}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={yRevenue(tick)}
              y2={yRevenue(tick)}
              stroke={GRID}
              strokeWidth={1}
            />
            <text
              x={PAD_LEFT - 8}
              y={yRevenue(tick) + 3.5}
              textAnchor="end"
              fill={AXIS_TEXT}
              style={{ font: AXIS_FONT, fontVariantNumeric: "tabular-nums" }}
            >
              {compact(tick)}
            </text>
          </g>
        ))}
        {months > 1 && (
          <path d={linePath} fill="none" stroke={MARK_ACCENT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {data.map((d, i) => (
          <g key={`m${d.month}`}>
            <circle cx={x(i)} cy={yRevenue(d.revenueCents / 100)} r={6} fill={SURFACE} />
            <circle cx={x(i)} cy={yRevenue(d.revenueCents / 100)} r={4} fill={MARK_ACCENT}>
              <title>{`${formatMonthLong(d.month)}: ${formatEuro(d.revenueCents)}`}</title>
            </circle>
          </g>
        ))}
        {last && last.revenueCents > 0 && (
          <text
            x={Math.min(x(months - 1), WIDTH - PAD_RIGHT - 30)}
            y={yRevenue(last.revenueCents / 100) - 10}
            textAnchor="middle"
            fill={LABEL_TEXT}
            style={{ font: LABEL_FONT, fontWeight: 600 }}
          >
            {formatEuro(last.revenueCents)}
          </text>
        )}

        {/* Shared month axis */}
        {data.map((d, i) => (
          <text
            key={`x${d.month}`}
            x={x(i)}
            y={revenueBase + 17}
            textAnchor="middle"
            fill={AXIS_TEXT}
            style={{ font: AXIS_FONT }}
          >
            {formatMonthShort(d.month)}
          </text>
        ))}
      </svg>

      <HiddenTable
        caption="Paid orders and revenue by month"
        headers={["Month", "Paid orders", "Revenue"]}
        rows={data.map((d) => [formatMonthLong(d.month), d.paid, formatEuro(d.revenueCents)])}
      />
    </ChartFrame>
  );
}
