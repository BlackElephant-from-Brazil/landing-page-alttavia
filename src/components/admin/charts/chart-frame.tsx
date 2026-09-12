/**
 * The card every overview chart sits in, and the shared pieces of the SVG:
 * the mark colours, the axis text and the hairline grid. The frame and the
 * hidden table are server components; the plots inside are small client
 * components (a tooltip on hover and focus), which import the same
 * constants. No chart library.
 *
 * Colour follows the dataviz rules. The monthly charts carry one hue per
 * series (paid columns navy, unpaid columns wheat, the revenue line gold
 * dark) and the donuts take the brand tokens in one fixed order, assigned by
 * index and never re-coloured when a slice is empty. Wheat and gold sit
 * under 3:1 on white, so every chart also carries value labels, a legend
 * with the numbers and the hidden table: colour is never the only channel.
 * Text never wears the series colour.
 *
 * Every chart renders its numbers as a visually hidden table right after
 * the figure, so a screen reader and a copy paste get the same data the eye
 * does.
 */

export { compact, niceMax, ticks } from "./geometry";

export const MARK = "#2D4B72";
export const MARK_ACCENT = "#A67D1E";
export const GRID = "rgba(14, 42, 71, 0.10)";
export const AXIS_TEXT = "#5B7199";
export const LABEL_TEXT = "#0E2A47";
export const SURFACE = "#FFFFFF";

/** The two series of the orders by month columns. */
export const PAID_MARK = "#0E2A47";
export const UNPAID_MARK = "#E0CF9F";

/**
 * The donut palette, in the fixed order the slices take: navy, gold,
 * navy soft, wheat, gold dark, clay, navy muted. A slice keeps the colour
 * of its index whatever the other slices hold.
 */
export const DONUT_PALETTE = ["#0E2A47", "#D0A12B", "#2D4B72", "#E0CF9F", "#A67D1E", "#C4322A", "#5B7199"] as const;

/** The colour of a legend row whose slice is empty. */
export const EMPTY_MARK = "rgba(14, 42, 71, 0.12)";

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

/** The empty line inside a chart when there is nothing in the range. */
export function EmptyChart({ children }: { children: React.ReactNode }) {
  return <p className="rounded-sm bg-paper px-4 py-6 text-center text-[0.88rem] text-navy-muted">{children}</p>;
}
