import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { formatEuro } from "@/content/bank-nif";
import { cn } from "@/lib/cn";
import type { ServiceRow, UserServiceRow } from "@/lib/db/types";

import { formatDate, ORDER_STATUS_LABEL, orderStatus, type OrderStatus } from "./order-status";

/**
 * "Your orders": every order of the account, newest first, with the
 * service, the date, the amount, the status and a link to the order's own
 * page. Admin contract section 7. A table from `sm` up, stacked cards
 * below it.
 */

const ORDER_PATH = "/en/dashboard/orders";
const FALLBACK_NAME = "Your order";

const STATUS_CLASS: Record<OrderStatus, string> = {
  awaiting_payment: "bg-gold/15 text-[#7A5A12]",
  in_progress: "bg-navy/5 text-navy-soft",
  completed: "bg-navy text-white",
};

export function OrdersTable({
  orders,
  services,
}: {
  orders: readonly UserServiceRow[];
  services: ReadonlyMap<string, ServiceRow>;
}) {
  return (
    <section aria-labelledby="orders-heading">
      <h2 id="orders-heading" className="text-xs uppercase tracking-wider text-navy-muted">
        Your orders
      </h2>

      {orders.length === 0 ? (
        <p className="mt-4 rounded-lg border border-navy/10 bg-white px-5 py-4 text-[0.95rem] text-navy-soft shadow-[var(--shadow-soft)]">
          No orders yet. Pick a service below, or answer a few questions at the start of the site and we recommend one.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-navy/10 bg-white shadow-[var(--shadow-soft)]">
          <table className="w-full min-w-[32rem] text-left text-[0.92rem]">
            <thead>
              <tr className="border-b border-navy/10 text-[0.72rem] uppercase tracking-[0.14em] text-navy-muted">
                <th scope="col" className="px-5 py-3 font-medium">
                  Service
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Date
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Amount
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-5 py-3">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/10">
              {orders.map((order) => {
                const service = services.get(order.service_id);
                const name = service?.name ?? FALLBACK_NAME;
                const status = orderStatus(order);
                return (
                  <tr key={order.id} className="align-middle">
                    <td className="px-5 py-4">
                      <Link
                        href={`${ORDER_PATH}/${order.id}`}
                        className="rounded-sm font-medium text-navy underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      >
                        {order.quantity === 2 ? `${name} · x2` : name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-navy-soft">
                      <time dateTime={order.created_at}>{formatDate(order.created_at)}</time>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-navy-soft">{formatEuro(order.total_cents)}</td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "inline-flex h-7 items-center whitespace-nowrap rounded-full px-3 text-[0.72rem] font-medium uppercase tracking-[0.14em]",
                          STATUS_CLASS[status],
                        )}
                      >
                        {ORDER_STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`${ORDER_PATH}/${order.id}`}
                        aria-label={`Open ${name} order of ${formatDate(order.created_at)}`}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm text-sm font-medium text-navy-soft underline-offset-4 transition-colors duration-200 hover:text-gold-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      >
                        Open
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
