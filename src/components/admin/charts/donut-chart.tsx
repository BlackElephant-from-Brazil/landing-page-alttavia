"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/cn";

import { formatCount } from "../lib/format";
import { ChartFrame, DONUT_PALETTE, EMPTY_MARK, HiddenTable } from "./chart-frame";
import { arcPath, donutSlices, gapDegrees, percentsTo100, polar } from "./geometry";
import { ChartTooltip, useChartTooltip } from "./tooltip";

/**
 * A part to whole donut: stroked SVG arcs on a ring, the total in the
 * centre, a legend beside it (under it on small screens) with the colour,
 * the label, the count and a whole percent that sums to 100. Slices take
 * the brand palette by index, never re-coloured when a neighbour is empty,
 * with a 2px surface gap between them; an item with no orders gets no
 * slice and stays in the legend greyed out.
 *
 * Hovering or focusing a slice, or hovering its legend row, thickens the
 * slice and shows a tooltip with label, count and percent. The hit target
 * of a slice is wider than the ring. With no orders at all the card shows
 * one line instead of an empty ring; the hidden table stays either way.
 *
 * Client component for the hover state only; the server passes the items.
 */

export type DonutItem = {
  key: string;
  label: string;
  count: number;
  /** Extra columns for the hidden table, after the count. */
  extra?: (string | number)[];
};

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 76;
const STROKE = 22;
const STROKE_ACTIVE = 28;
const HIT = STROKE_ACTIVE + 12;

export function DonutChart({
  id,
  title,
  description,
  items,
  unit,
  headers,
  emptyText,
  footer,
}: {
  id: string;
  title: string;
  description?: string;
  items: DonutItem[];
  /** What the centre counts: "orders". */
  unit: string;
  /** The hidden table's headers: the label column, the count column, then any `extra`. */
  headers: string[];
  emptyText: string;
  footer?: string;
}) {
  const { wrapperRef, tip, show, hide } = useChartTooltip();
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<string | null>(null);

  const counts = items.map((item) => item.count);
  const total = counts.reduce((sum, c) => sum + c, 0);
  const percents = percentsTo100(counts);
  const slices = donutSlices(counts, gapDegrees(2, RADIUS));
  const colorOf = (index: number) => DONUT_PALETTE[index % DONUT_PALETTE.length];

  const text = (index: number) => `${items[index].label}: ${formatCount(items[index].count)} ${unit}, ${percents[index]}%`;
  const lines = (index: number) => [
    { label: unit, value: formatCount(items[index].count), swatch: { color: colorOf(index), shape: "rect" as const } },
    { label: "of the total", value: `${percents[index]}%` },
  ];

  // The tooltip points at the outer edge of the slice, from the ring or
  // from the legend row alike.
  const enter = (index: number, target: Element) => {
    setActive(items[index].key);
    const slice = slices.find((s) => s.index === index);
    const svg = svgRef.current;
    const anchor =
      slice && svg ? { svg, ...polar(CENTER, CENTER, RADIUS + STROKE_ACTIVE / 2 + 2, (slice.start + slice.end) / 2) } : undefined;
    show(target, items[index].label, lines(index), anchor);
  };
  const leave = () => {
    setActive(null);
    hide();
  };

  return (
    <ChartFrame id={id} title={title} description={description}>
      {total === 0 ? (
        <p className="rounded-sm bg-paper px-4 py-6 text-center text-[0.88rem] text-navy-muted">{emptyText}</p>
      ) : (
        <div ref={wrapperRef} className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
          <svg ref={svgRef} viewBox={`0 0 ${SIZE} ${SIZE}`} role="group" aria-label={title} className="h-auto w-[12.5rem] shrink-0">
            {slices.map((slice) => {
              const item = items[slice.index];
              const hovered = active === item.key;
              const d = arcPath(CENTER, CENTER, RADIUS, slice.start, slice.end);
              return (
                <g key={item.key}>
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={HIT}
                    role="img"
                    tabIndex={0}
                    aria-label={text(slice.index)}
                    className="cursor-default focus:outline-none"
                    onPointerEnter={(event) => enter(slice.index, event.currentTarget)}
                    onPointerLeave={leave}
                    onFocus={(event) => enter(slice.index, event.currentTarget)}
                    onBlur={leave}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke={colorOf(slice.index)}
                    strokeWidth={hovered ? STROKE_ACTIVE : STROKE}
                    className="pointer-events-none transition-[stroke-width] duration-150"
                  />
                </g>
              );
            })}
            <text x={CENTER} y={CENTER + 2} textAnchor="middle" fill="#0E2A47" style={{ font: "600 30px var(--font-inter), ui-sans-serif, system-ui, sans-serif" }}>
              {formatCount(total)}
            </text>
            <text x={CENTER} y={CENTER + 22} textAnchor="middle" fill="#5B7199" style={{ font: "11px var(--font-inter), ui-sans-serif, system-ui, sans-serif", letterSpacing: "0.1em" }}>
              {unit.toUpperCase()}
            </text>
          </svg>

          <ul className="w-full max-w-[18rem] space-y-1.5 text-[0.82rem]" aria-label="Legend">
            {items.map((item, index) => {
              const empty = item.count === 0;
              return (
                <li
                  key={item.key}
                  className={cn(
                    "flex items-center gap-2.5 rounded-sm px-1.5 py-0.5 transition-colors duration-150",
                    empty ? "text-navy-muted/70" : "text-navy",
                    !empty && active === item.key && "bg-gold/10",
                  )}
                  onPointerEnter={empty ? undefined : (event) => enter(index, event.currentTarget)}
                  onPointerLeave={empty ? undefined : leave}
                >
                  <span aria-hidden className="inline-block size-3 shrink-0 rounded-[2px]" style={{ background: empty ? EMPTY_MARK : colorOf(index) }} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className={cn("shrink-0 tabular-nums", empty ? "" : "font-semibold")}>{formatCount(item.count)}</span>
                  <span className="w-9 shrink-0 text-right tabular-nums text-navy-muted">{percents[index]}%</span>
                </li>
              );
            })}
          </ul>
          <ChartTooltip tip={tip} />
        </div>
      )}

      {footer && <p className="mt-3 text-[0.8rem] text-navy-muted">{footer}</p>}

      <HiddenTable
        caption={title}
        headers={[...headers, "Share"]}
        rows={items.map((item, index) => [item.label, item.count, ...(item.extra ?? []), `${percents[index]}%`])}
      />
    </ChartFrame>
  );
}
