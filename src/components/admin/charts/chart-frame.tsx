/**
 * The card every overview chart sits in, and the shared pieces of the SVG:
 * the mark colours, the axis text and the hairline grid. Server components
 * only; no chart library, no script.
 *
 * Colour follows the dataviz rules: one series per chart, so one hue per
 * chart and no legend box (the title names the series). Marks are
 * navy-soft (8.9:1 on white) and the revenue line is gold-dark (3.8:1),
 * both above the 3:1 floor for marks. Text never wears the series colour.
 *
 * Every chart also renders its numbers as a visually hidden table right
 * after the figure, so a screen reader and a copy paste get the same data
 * the eye does.
 */

export const MARK = "#2D4B72";
export const MARK_ACCENT = "#A67D1E";
export const GRID = "rgba(14, 42, 71, 0.10)";
export const AXIS_TEXT = "#5B7199";
export const LABEL_TEXT = "#0E2A47";
export const SURFACE = "#FFFFFF";

export const AXIS_FONT = "11px var(--font-inter), ui-sans-serif, system-ui, sans-serif";
export const LABEL_FONT = "12px var(--font-inter), ui-sans-serif, system-ui, sans-serif";

export function ChartFrame({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <figure
      aria-labelledby={`${id}-title`}
      className="rounded-lg border border-navy/10 bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6"
    >
      <figcaption>
        <h3 id={`${id}-title`} className="font-serif text-lg leading-snug text-navy">
          {title}
        </h3>
        {description && <p className="mt-1 text-[0.82rem] leading-relaxed text-navy-muted">{description}</p>}
      </figcaption>
      <div className="mt-4">{children}</div>
    </figure>
  );
}

/** The same numbers as the figure, for assistive technology. */
export function HiddenTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header} scope="col">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) =>
              j === 0 ? (
                <th key={j} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={j}>{cell}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A clean top of axis for a value: 0 to 4 becomes 4, 0 to 37 becomes 40, 0 to 2600 becomes 3000. */
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

/** A short axis label for a count or euros: 12, 1.2k, 1.2M. */
export function compact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (Math.abs(value) >= 1_000) return `${trim(value / 1_000)}k`;
  return trim(value);
}

function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

/** The empty line inside a chart when there is nothing in the range. */
export function EmptyChart({ children }: { children: React.ReactNode }) {
  return <p className="rounded-sm bg-paper px-4 py-6 text-center text-[0.88rem] text-navy-muted">{children}</p>;
}
