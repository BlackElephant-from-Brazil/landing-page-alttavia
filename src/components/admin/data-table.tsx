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

export type PillTone = "muted" | "gold" | "navy" | "clay" | "green" | "amber";

/**
 * A small status pill, the same shape the client's document slot uses.
 * Every text colour clears 4.5:1 on white: green #1F7A4D is 5.3:1 and
 * amber #9A5F0F is 5.2:1 (the lighter #B5731A tints the background only).
 */
export function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[0.68rem] font-medium uppercase tracking-[0.12em]",
        tone === "muted" && "bg-navy/5 text-navy-soft",
        tone === "gold" && "bg-gold/15 text-[#7A5A12]",
        tone === "navy" && "bg-navy text-white",
        tone === "clay" && "bg-clay/10 text-[#B52D25]",
        tone === "green" && "bg-[#1F7A4D]/10 text-[#1F7A4D]",
        tone === "amber" && "bg-[#B5731A]/10 text-[#9A5F0F]",
      )}
    >
      {children}
    </span>
  );
}

/**
 * The "Paid on" cell every orders table shares: the date on a green pill
 * once paid, "Not yet" on an amber one until then, so the column reads at
 * a glance without relying on the colour alone.
 */
export function PaidOn({ paidAt, formatDate }: { paidAt: string | null; formatDate: (value: string) => string }) {
  return paidAt ? (
    <Pill tone="green">
      <span className="normal-case tracking-normal">{formatDate(paidAt)}</span>
    </Pill>
  ) : (
    <Pill tone="amber">Not yet</Pill>
  );
}
