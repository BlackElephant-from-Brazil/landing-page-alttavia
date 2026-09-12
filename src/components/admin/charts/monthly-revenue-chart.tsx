"use client";

import { useState } from "react";

import type { Overview } from "@/lib/db/types";

import { formatEuro, formatMonthLong, formatMonthShort } from "../lib/format";
import { AXIS_FONT, AXIS_TEXT, ChartFrame, GRID, HiddenTable, LABEL_FONT, LABEL_TEXT, MARK_ACCENT, SURFACE, compact, niceMax, ticks } from "./chart-frame";
import { countTicks } from "./geometry";
import { ChartTooltip, useChartTooltip, type TooltipAnchor } from "./tooltip";

/**
 * Revenue by month, the last six, as one gold line (2px, round joins) with
 * 8px markers ringed in the surface colour, on a euro axis. One series, so
 * no legend: the title names it. Only the latest month is labelled
 * directly; the ticks, the tooltip and the hidden table carry the rest.
 *
 * Each month has one hit area the height of the plot, hoverable and
 * focusable, that shows the month and its revenue and grows the marker.
 * Client component for the tooltip only; the server passes the data.
 */

const WIDTH = 560;
const PAD_LEFT = 52;
const PAD_RIGHT = 16;
const PLOT_HEIGHT = 168;
const AXIS_BAND = 24;
const TOP = 18;
const HEIGHT = TOP + PLOT_HEIGHT + AXIS_BAND;

/** The tooltip anchor for a hit area, in its SVG's units. */
function anchor(target: SVGGraphicsElement, x: number, y: number): TooltipAnchor | undefined {
  return target.ownerSVGElement ? { svg: target.ownerSVGElement, x, y } : undefined;
}

export function MonthlyRevenueChart({ data }: { data: Overview["ordersByMonth"] }) {
  const { wrapperRef, tip, show, hide } = useChartTooltip();
  const [active, setActive] = useState<string | null>(null);

  const months = data.length;
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const slot = months > 0 ? plotWidth / months : plotWidth;

  const max = niceMax(Math.max(0, ...data.map((d) => d.revenueCents / 100)));
  // Whole euros on the axis: four ticks once the top is at least 4, and
  // one per euro below that (an empty chart reads €0 and €1, not €0.25).
  const axisTicks = max >= 4 ? ticks(max, 4) : countTicks(max);
  const base = TOP + PLOT_HEIGHT;
  const x = (i: number) => PAD_LEFT + slot * i + slot / 2;
  const y = (cents: number) => base - (cents / 100 / max) * PLOT_HEIGHT;

  const last = data[months - 1];
  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.revenueCents).toFixed(1)}`).join(" ");

  return (
    <ChartFrame id="revenue-month-chart" title="Revenue by month" description="Euros from orders paid in each of the last six months.">
      <div ref={wrapperRef} className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label="Revenue by month, last six months" className="h-auto w-full">
          {axisTicks.map((tick) => (
            <g key={tick}>
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y(tick * 100)} y2={y(tick * 100)} stroke={GRID} strokeWidth={1} />
              <text x={PAD_LEFT - 8} y={y(tick * 100) + 3.5} textAnchor="end" fill={AXIS_TEXT} style={{ font: AXIS_FONT, fontVariantNumeric: "tabular-nums" }}>
                {tick === 0 ? "€0" : `€${compact(tick)}`}
              </text>
            </g>
          ))}
          <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={base} y2={base} stroke={GRID} strokeWidth={1} />

          {months > 1 && <path d={linePath} fill="none" stroke={MARK_ACCENT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}

          {data.map((d, i) => {
            const hovered = active === d.month;
            const cy = y(d.revenueCents);
            const text = `${formatMonthLong(d.month)}: ${formatEuro(d.revenueCents)}`;
            const line = [{ label: "revenue", value: formatEuro(d.revenueCents), swatch: { color: MARK_ACCENT, shape: "line" as const } }];
            const open = (target: SVGGraphicsElement) => {
              setActive(d.month);
              show(target, formatMonthLong(d.month), line, anchor(target, x(i), cy - 10));
            };
            return (
              <g key={d.month}>
                <circle cx={x(i)} cy={cy} r={hovered ? 8 : 6} fill={SURFACE} />
                <circle cx={x(i)} cy={cy} r={hovered ? 6 : 4} fill={MARK_ACCENT} />
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
                  aria-label={text}
                  className="cursor-default focus:outline-none"
                  onPointerEnter={(event) => open(event.currentTarget)}
                  onPointerLeave={() => {
                    setActive(null);
                    hide();
                  }}
                  onFocus={(event) => open(event.currentTarget)}
                  onBlur={() => {
                    setActive(null);
                    hide();
                  }}
                />
              </g>
            );
          })}

          {last && last.revenueCents > 0 && !active && (
            <text
              x={Math.min(x(months - 1), WIDTH - PAD_RIGHT - 30)}
              y={y(last.revenueCents) - 12}
              textAnchor="middle"
              fill={LABEL_TEXT}
              style={{ font: LABEL_FONT, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
            >
              {formatEuro(last.revenueCents)}
            </text>
          )}
        </svg>
        <ChartTooltip tip={tip} />
      </div>

      <HiddenTable caption="Revenue by month" headers={["Month", "Revenue"]} rows={data.map((d) => [formatMonthLong(d.month), formatEuro(d.revenueCents)])} />
    </ChartFrame>
  );
}
