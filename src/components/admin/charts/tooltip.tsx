"use client";

import { useCallback, useRef, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * The hover layer the overview charts share. A chart wraps its SVG in a
 * `relative` div (`wrapperRef`), and every hit area calls `show` on pointer
 * enter and on focus with itself and the lines to print, and `hide` on
 * pointer leave and blur. The tooltip is HTML positioned over the wrapper
 * from the hit area's bounding box, so it stays crisp whatever size the
 * responsive SVG renders at, and it flips to the left or right edge when
 * the anchor sits near one.
 *
 * The tooltip never gates: the same text is the hit area's `aria-label`,
 * and every number is also in the chart's hidden table. It is aria-hidden
 * for that reason, so a screen reader hears each value once.
 */

export type TooltipLine = {
  label: string;
  value: string;
  /** The mark's colour, keyed as a small rect (columns, slices) or a short line. */
  swatch?: { color: string; shape: "rect" | "line" };
};

export type TooltipState = {
  x: number;
  y: number;
  align: "left" | "center" | "right";
  title: string;
  lines: TooltipLine[];
};

const EDGE = 96;

/**
 * Where the tooltip points: a spot in an SVG's own units (the top of a
 * column, the outer edge of a slice), mapped through the SVG's current
 * transform so it lands right whatever size the SVG renders at.
 */
export type TooltipAnchor = { svg: SVGSVGElement; x: number; y: number };

export function useChartTooltip() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TooltipState | null>(null);

  const show = useCallback((target: Element, title: string, lines: TooltipLine[], anchor?: TooltipAnchor) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const frame = wrapper.getBoundingClientRect();
    let x: number;
    let y: number;
    const matrix = anchor?.svg.getScreenCTM();
    if (anchor && matrix) {
      const point = new DOMPoint(anchor.x, anchor.y).matrixTransform(matrix);
      x = point.x - frame.left;
      y = point.y - frame.top;
    } else {
      const box = target.getBoundingClientRect();
      x = box.left + box.width / 2 - frame.left;
      y = box.top - frame.top;
    }
    const align = x < EDGE ? "left" : x > frame.width - EDGE ? "right" : "center";
    setTip({ x, y, align, title, lines });
  }, []);

  const hide = useCallback(() => setTip(null), []);

  return { wrapperRef, tip, show, hide };
}

export function ChartTooltip({ tip }: { tip: TooltipState | null }) {
  if (!tip) return null;
  const transform =
    tip.align === "left"
      ? "translate(-12px, calc(-100% - 10px))"
      : tip.align === "right"
        ? "translate(calc(-100% + 12px), calc(-100% - 10px))"
        : "translate(-50%, calc(-100% - 10px))";

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-10 min-w-[8.5rem] max-w-[16rem] rounded-md border border-navy/10 bg-white px-3 py-2 text-[0.78rem] leading-snug text-navy shadow-[var(--shadow-card)]"
      style={{ left: tip.x, top: Math.max(0, tip.y), transform }}
    >
      <p className="text-[0.7rem] font-medium uppercase tracking-[0.12em] text-navy-muted">{tip.title}</p>
      <ul className="mt-1 space-y-0.5">
        {tip.lines.map((line) => (
          <li key={line.label} className="flex items-center gap-2">
            {line.swatch && (
              <span
                aria-hidden
                className={cn("inline-block shrink-0", line.swatch.shape === "line" ? "h-0.5 w-3 rounded-full" : "size-2.5 rounded-[2px]")}
                style={{ background: line.swatch.color }}
              />
            )}
            <span className="font-semibold tabular-nums text-navy">{line.value}</span>
            <span className="text-navy-soft">{line.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
