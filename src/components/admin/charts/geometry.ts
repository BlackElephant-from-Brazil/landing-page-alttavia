/**
 * The pure geometry behind the overview charts: axis scales for the
 * columns and the line, arcs for the donuts, and the percent rounding the
 * donut legends show. No React, no DOM, so every helper is unit tested in
 * geometry.test.ts and shared by the server wrappers and the client charts.
 */

/** A clean top of axis for a value: 0 to 4 becomes 5, 0 to 37 becomes 50, 0 to 2600 becomes 5000, 0 to 20 stays 20. */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const unit = max / magnitude;
  const step = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return step * magnitude;
}

/** Three or four evenly spaced tick values from 0 to `max`. */
export function ticks(max: number, count = 4): number[] {
  const step = max / count;
  return Array.from({ length: count + 1 }, (_, i) => Math.round(step * i * 100) / 100);
}

/**
 * Ticks for an axis of whole counts, so a top of 5 reads 0 to 5 by one and
 * never 1.25, 2.5. `max` is a niceMax value (1, 2, 2.5, 5 or 10 times a
 * power of ten), so one of the divisors below always lands on integers.
 */
export function countTicks(max: number): number[] {
  const top = Math.max(1, Math.ceil(max));
  const count = top <= 5 ? top : top % 5 === 0 ? 5 : top % 4 === 0 ? 4 : top % 2 === 0 ? 2 : 1;
  return ticks(top, count);
}

/** A short axis label for a count or euros: 12, 1.2k, 1.2M. */
export function compact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (Math.abs(value) >= 1_000) return `${trim(value / 1_000)}k`;
  return trim(value);
}

function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

// ---------------------------------------------------------------------------
// Donut
// ---------------------------------------------------------------------------

/** A point on a circle. Angles are degrees clockwise from the top. */
export function polar(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function fixed(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(Math.abs(rounded) < 0.005 ? 0 : rounded);
}

/**
 * The `d` of an open arc from `start` to `end` degrees on a circle, meant to
 * be stroked (the donut ring is the stroke). A sweep of 360 or more draws
 * the whole circle as two half arcs, since a single SVG arc cannot close on
 * itself. A sweep of zero or less is an empty path.
 */
export function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const sweep = end - start;
  if (sweep <= 0) return "";
  if (sweep >= 360) {
    const top = polar(cx, cy, r, start);
    const bottom = polar(cx, cy, r, start + 180);
    return `M${fixed(top.x)},${fixed(top.y)} A${r},${r} 0 1 1 ${fixed(bottom.x)},${fixed(bottom.y)} A${r},${r} 0 1 1 ${fixed(top.x)},${fixed(top.y)}`;
  }
  const from = polar(cx, cy, r, start);
  const to = polar(cx, cy, r, end);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M${fixed(from.x)},${fixed(from.y)} A${r},${r} 0 ${largeArc} 1 ${fixed(to.x)},${fixed(to.y)}`;
}

export type Slice = {
  index: number;
  value: number;
  /** Degrees clockwise from the top, the gap already taken out. */
  start: number;
  end: number;
};

/**
 * The angular layout of a donut. Every positive value gets a slice in
 * input order, starting at the top; zeros get none. `gap` is the angle, in
 * degrees, of the surface gap left between neighbouring slices (both sides
 * of every slice give up half of it). A single slice fills the ring with no
 * gap. A slice too small to survive the gap keeps a hairline rather than a
 * negative sweep.
 */
export function donutSlices(values: number[], gap = 0): Slice[] {
  const positive = values.map((value, index) => ({ index, value })).filter((v) => v.value > 0);
  const total = positive.reduce((sum, v) => sum + v.value, 0);
  if (total <= 0) return [];
  const spacing = positive.length > 1 ? gap : 0;

  let cursor = 0;
  return positive.map(({ index, value }) => {
    const sweep = (value / total) * 360;
    const start = cursor + spacing / 2;
    const end = Math.max(start + 0.5, cursor + sweep - spacing / 2);
    cursor += sweep;
    return { index, value, start, end };
  });
}

/** The angle, in degrees, that a gap of `px` takes on a circle of radius `r`. */
export function gapDegrees(px: number, r: number): number {
  return r > 0 ? (px / r) * (180 / Math.PI) : 0;
}

/**
 * Whole percents that add up to exactly 100 (largest remainder method), so
 * a legend never reads 33, 33, 33. Zero values stay 0; an all zero input
 * gives all zeros.
 */
export function percentsTo100(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + Math.max(0, v), 0);
  if (total <= 0) return values.map(() => 0);

  const exact = values.map((v) => (Math.max(0, v) / total) * 100);
  const floors = exact.map((p) => Math.floor(p));
  let remainder = 100 - floors.reduce((sum, p) => sum + p, 0);

  const order = exact
    .map((p, index) => ({ index, fraction: p - Math.floor(p), value: values[index] }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (const entry of order) {
    if (remainder <= 0) break;
    floors[entry.index] += 1;
    remainder -= 1;
  }
  return floors;
}
