import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { formatEuro } from "@/content/bank-nif";
import type { ClientOrderSummary } from "@/lib/db/client-queries";

import { formatDate } from "./order-status";
import { PaymentPill } from "./pills";

/**
 * The purchases table: service, date, amount, payment state, progress and
 * an Open link, newest first. The dashboard home shows the three most
 * recent rows with a "See all" link; the purchases page shows every row.
 *
 * The whole row opens the order: a real link in the first cell is stretched
 * over the row by absolute positioning (the row is `relative`), so the row
 * stays a `<tr>` for assistive technology and is one tab stop, and the Open
 * link at the end is a second, visible way in for anyone who expects one.
 * Both point at `?order=<id>` on the page that renders the table, which the
 * server answers with the order modal; `scroll={false}` keeps the page where
 * it was when the modal closes again.
 */

const copy = {
  service: "Service",
  date: "Date",
  amount: "Amount",
  payment: "Payment",
  progress: "Progress",
  open: "Open",
  openAria: (name: string, date: string) => `Open ${name}, ordered ${date}`,
  completed: "Completed",
} as const;

export function PurchasesTable({
  items,
  basePath,
  caption,
}: {
  items: readonly ClientOrderSummary[];
  /** The page's own path: rows link to `${basePath}?order=<id>`. */
  basePath: string;
  caption: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-navy/10 bg-white shadow-[var(--shadow-soft)]">
      <table className="w-full min-w-[40rem] border-collapse text-left text-[0.92rem]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-navy/10 bg-paper text-[0.7rem] uppercase tracking-[0.14em] text-navy-muted">
            <th scope="col" className="px-5 py-3 font-medium">
              {copy.service}
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              {copy.date}
            </th>
            <th scope="col" className="px-5 py-3 text-right font-medium">
              {copy.amount}
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              {copy.payment}
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              {copy.progress}
            </th>
            <th scope="col" className="px-5 py-3">
              <span className="sr-only">{copy.open}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ order, service, stageLabel }) => {
            const name = service.name;
            const href = `${basePath}?order=${order.id}`;
            const date = formatDate(order.created_at);
            return (
              <tr
                key={order.id}
                className="relative border-b border-navy/5 align-middle transition-colors duration-150 last:border-b-0 hover:bg-gold/5 has-[a:focus-visible]:bg-gold/10"
              >
                <td className="px-5 py-4">
                  <Link
                    href={href}
                    scroll={false}
                    aria-label={copy.openAria(name, date)}
                    className="font-medium text-navy after:absolute after:inset-0 after:rounded-sm after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-gold"
                  >
                    {name}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-navy-soft">
                  <time dateTime={order.created_at}>{date}</time>
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-navy-soft">{formatEuro(order.total_cents)}</td>
                <td className="px-5 py-4">
                  <PaymentPill order={order} />
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-navy-soft">{order.completed_at ? copy.completed : stageLabel}</td>
                <td className="px-5 py-4 text-right">
                  <Link
                    href={href}
                    scroll={false}
                    tabIndex={-1}
                    aria-hidden
                    className="relative inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-navy-soft underline-offset-4 transition-colors duration-200 hover:text-gold-dark hover:underline"
                  >
                    {copy.open}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
