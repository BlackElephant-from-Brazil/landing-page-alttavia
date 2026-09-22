import Link from "next/link";

import { cn } from "@/lib/cn";

/**
 * Board or table, as two links that keep every other query parameter, so a
 * switch never loses the filters, the page or the order the modal has open.
 *
 * Nothing is stored: `?view=table` selects the table and anything else, the
 * parameter missing included, opens the board. Entering /admin/orders
 * therefore always lands on the board, which is what the firm asked for.
 */

export type OrdersView = "kanban" | "table";

/** `?view=table` and nothing else selects the table. */
export function viewFromParam(value: string | undefined): OrdersView {
  return value === "table" ? "table" : "kanban";
}

export function ViewSwitch({ view, kanbanHref, tableHref }: { view: OrdersView; kanbanHref: string; tableHref: string }) {
  return (
    <nav aria-label="Order views" className="inline-flex rounded-full border border-navy/15 bg-white p-1 shadow-[var(--shadow-soft)]">
      <ViewLink href={kanbanHref} current={view === "kanban"}>
        Kanban
      </ViewLink>
      <ViewLink href={tableHref} current={view === "table"}>
        Table
      </ViewLink>
    </nav>
  );
}

function ViewLink({ href, current, children }: { href: string; current: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={current ? "true" : undefined}
      className={cn(
        "inline-flex h-8 items-center rounded-full px-4 text-[0.82rem] font-medium transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        current ? "bg-navy text-white" : "text-navy-soft hover:bg-navy/5 hover:text-navy",
      )}
    >
      {children}
    </Link>
  );
}
