import Link from "next/link";

import { cn } from "@/lib/cn";

/**
 * The table the admin pages share: a bordered white card, a muted header
 * row with `scope="col"`, and rows that are links when the caller gives
 * them an href. The whole row is clickable through one link cell that
 * spans it by absolute positioning, so the row stays a real `<tr>` for
 * assistive technology and the link is one tab stop.
 *
 * Wide tables scroll inside the card; the page never does.
 */

export type Column<Row> = {
  key: string;
  header: string;
  /** Right aligns numbers. */
  align?: "left" | "right";
  className?: string;
  cell: (row: Row) => React.ReactNode;
};

export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  rowHref,
  rowLabel,
  empty,
  className,
}: {
  caption: string;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** When given, the row opens this href. */
  rowHref?: (row: Row) => string;
  /** The accessible name of the row's link ("Open order for a@b.c"). */
  rowLabel?: (row: Row) => string;
  empty: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-navy/10 bg-white shadow-[var(--shadow-soft)]", className)}>
      <table className="w-full min-w-[40rem] border-collapse text-left text-[0.88rem]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-navy/10 bg-paper">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-4 py-3 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-navy-muted",
                  column.align === "right" && "text-right",
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
            {rowHref && (
              <th scope="col" className="w-0 px-0 py-3">
                <span className="sr-only">Open</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (rowHref ? 1 : 0)} className="px-4 py-8 text-center text-navy-muted">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={cn(
                  "relative border-b border-navy/5 last:border-b-0",
                  rowHref && "transition-colors duration-150 hover:bg-gold/5 has-[a:focus-visible]:bg-gold/10",
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-4 py-3 align-top text-navy",
                      column.align === "right" && "text-right tabular-nums",
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
                {rowHref && (
                  <td className="px-0 py-0">
                    <Link
                      href={rowHref(row)}
                      scroll={false}
                      aria-label={rowLabel ? rowLabel(row) : "Open"}
                      className="absolute inset-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold"
                    >
                      <span className="sr-only">Open</span>
                    </Link>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** A small status pill, the same shape the client's document slot uses. */
export function Pill({ tone, children }: { tone: "muted" | "gold" | "navy" | "clay"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[0.68rem] font-medium uppercase tracking-[0.12em]",
        tone === "muted" && "bg-navy/5 text-navy-muted",
        tone === "gold" && "bg-gold/15 text-gold-dark",
        tone === "navy" && "bg-navy text-white",
        tone === "clay" && "bg-clay/10 text-clay",
      )}
    >
      {children}
    </span>
  );
}
