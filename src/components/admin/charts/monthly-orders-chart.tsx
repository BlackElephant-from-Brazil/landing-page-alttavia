"use client";

import { useState } from "react";

import type { Overview } from "@/lib/db/types";

import { formatCount, formatMonthLong, formatMonthShort } from "../lib/format";
import {
  AXIS_FONT,
  AXIS_TEXT,
  ChartFrame,
  GRID,
  HiddenTable,
  LABEL_FONT,
  LABEL_TEXT,
  MARK_ACCENT,
  PAID_MARK,
  UNPAID_MARK,
  compact,
  niceMax,
} from "./chart-frame";
import { countTicks } from "./geometry";
import { ChartTooltip, useChartTooltip, type TooltipAnchor } from "./tooltip";

/**
 * Orders by month, the last six: one stacked column per month, the paid
 * orders in navy at the base and the orders created that month and still
 * unpaid in wheat on top, with a 2px surface gap between the two. Two
 * series, so a legend sits under the plot; the total rides on every cap.
 * Columns are capped at 24px, rounded at the data end and square at the
 * baseline.
 *
 * Each month has one hit area the height of the plot, hoverable and
 * focusable, that shows a tooltip with the month, paid, not paid and the
 * total; the hovered column takes a gold outline. Client component for the
 * tooltip only; the server passes the data.
 */

const WIDTH = 560;
const PAD_LEFT = 40;
const PAD_RIGHT = 16;
const PLOT_HEIGHT = 168;
const AXIS_BAND = 24;
const TOP = 18;
const HEIGHT = TOP + PLOT_HEIGHT + AXIS_BAND;
const MAX_BAR = 24;
const GAP = 2;

const LEGEND = [
  { label: "Paid", color: PAID_MARK },
  { label: "Not paid", color: UNPAID_MARK },
] as const;

/** The tooltip anchor for a hit area, in its SVG's units. */
function anchor(target: SVGGraphicsElement, x: number, y: number): TooltipAnchor | undefined {
  return target.ownerSVGElement ? { svg: target.ownerSVGElement, x, y } : undefined;
}

function columnPath(left: number, width: number, top: number, base: number, rounded: boolean): string {
  const height = base - top;
  if (height <= 0) return "";
  const r = rounded ? Math.min(4, height) : 0;
  return `M${left},${base} V${top + r} Q${left},${top} ${left + r},${top} H${left + width - r} Q${left + width},${top} ${left + width},${top + r} V${base} Z`;
}

export function MonthlyOrdersChart({ data }: { data: Overview["ordersByMonth"] }) {
  const { wrapperRef, tip, show, hide } = useChartTooltip();
  const [active, setActive] = useState<string | null>(null);

  const months = data.length;
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const slot = months > 0 ? plotWidth / months : plotWidth;
  const bar = Math.min(MAX_BAR, slot * 0.5);

  const max = niceMax(Math.max(0, ...data.map((d) => d.paid + d.open)));
  const axisTicks = countTicks(max);
  const base = TOP + PLOT_HEIGHT;
  const x = (i: number) => PAD_LEFT + slot * i + slot / 2;
  const y = (v: number) => base - (v / max) * PLOT_HEIGHT;

  const label = (d: Overview["ordersByMonth"][number]) =>
    `${formatMonthLong(d.month)}: ${formatCount(d.paid)} paid, ${formatCount(d.open)} not paid, ${formatCount(d.paid + d.open)} in total`;

  const lines = (d: Overview["ordersByMonth"][number]) => [
    { label: "paid", value: formatCount(d.paid), swatch: { color: PAID_MARK, shape: "rect" as const } },
    { label: "not paid", value: formatCount(d.open), swatch: { color: UNPAID_MARK, shape: "rect" as const } },
    { label: "in total", value: formatCount(d.paid + d.open) },
  ];

  return (
    <ChartFrame id="orders-month-chart" title="Orders by month" description="The last six months, this one included. Paid by payment date, not paid by creation date.">
      <div ref={wrapperRef} className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label="Orders by month, last six months" className="h-auto w-full">
          {axisTicks.map((tick) => (
            <g key={tick}>
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth={1} />
              <text x={PAD_LEFT - 8} y={y(tick) + 3.5} textAnchor="end" fill={AXIS_TEXT} style={{ font: AXIS_FONT, fontVariantNumeric: "tabular-nums" }}>
                {compact(tick)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const total = d.paid + d.open;
            const left = x(i) - bar / 2;
            const paidTop = y(d.paid);
            const openTop = y(total);
            const paidPath = columnPath(left, bar, paidTop, base, d.open === 0);
            // The wheat segment starts one gap above the navy one; a gap on
            // an empty navy base would float, so it stays on the baseline.
            const openBase = d.paid > 0 ? paidTop - GAP : base;
            const openPath = d.open > 0 ? columnPath(left, bar, Math.min(openTop, openBase - 0.5), openBase, true) : "";
            const hovered = active === d.month;
            return (
              <g key={d.month}>
                {paidPath && <path d={paidPath} fill={PAID_MARK} stroke={hovered ? MARK_ACCENT : "none"} strokeWidth={1.5} />}
                {openPath && <path d={openPath} fill={UNPAID_MARK} stroke={hovered ? MARK_ACCENT : "none"} strokeWidth={1.5} />}
                {total > 0 && (
                  <text x={x(i)} y={openTop - 6} textAnchor="middle" fill={LABEL_TEXT} style={{ font: LABEL_FONT, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {formatCount(total)}
                  </text>
                )}
                <text x={x(i)} y={base + 17} textAnchor="middle" fill={AXIS_TEXT} style={{ font: AXIS_FONT }}>
                  {formatMonthShort(d.month)}
                </text>
                <rect
                  x={PAD_LEFT + slot * i}
                  y={TOP - 12}
                  width={slot}
                  height={PLOT_HEIGHT + 12}
                  fill="transparent"
                  role="img"
                  tabIndex={0}
                  aria-label={label(d)}
                  className="cursor-default focus:outline-none"
                  onPointerEnter={(event) => {
                    setActive(d.month);
                    show(event.currentTarget, formatMonthLong(d.month), lines(d), anchor(event.currentTarget, x(i), total > 0 ? openTop - 14 : base));
                  }}
                  onPointerLeave={() => {
                    setActive(null);
                    hide();
                  }}
                  onFocus={(event) => {
                    setActive(d.month);
                    show(event.currentTarget, formatMonthLong(d.month), lines(d), anchor(event.currentTarget, x(i), total > 0 ? openTop - 14 : base));
                  }}
                  onBlur={() => {
                    setActive(null);
                    hide();
                  }}
                />
              </g>
            );
          })}
          <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={base} y2={base} stroke={GRID} strokeWidth={1} />
        </svg>
        <ChartTooltip tip={tip} />
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.8rem] text-navy-soft" aria-label="Legend">
        {LEGEND.map((entry) => (
          <li key={entry.label} className="inline-flex items-center gap-2">
            <span aria-hidden className="inline-block size-3 rounded-[2px] border border-navy/10" style={{ background: entry.color }} />
            {entry.label}
          </li>
        ))}
      </ul>

      <HiddenTable
        caption="Orders by month"
        headers={["Month", "Paid", "Not paid", "Total"]}
        rows={data.map((d) => [formatMonthLong(d.month), d.paid, d.open, d.paid + d.open])}
      />
    </ChartFrame>
  );
}
