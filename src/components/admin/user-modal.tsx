import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { getUserDetail } from "@/lib/db/admin-queries";
import type { AdminOrderRow, AdminUserDetail } from "@/lib/db/types";
import { requireAdminPage } from "@/lib/supabase/admin-user";
import { createClient } from "@/lib/supabase/server";

import { PaidOn, Pill } from "./data-table";
import { formatCount, formatDate, formatEuro, humanizeKey } from "./lib/format";
import { isUuid } from "./lib/params";
import { Modal } from "./modal";

/**
 * The user detail, opened by `?user=<id>` on the users page: the profile
 * (email, name, phone, joined on, role) and the list of that person's
 * orders, each linking to the orders page with its own modal open
 * (`/admin/orders?order=<id>`).
 *
 * Server component, read with the user client (RLS `is_admin()` decides).
 * An id that is not a UUID or is unknown still opens the modal, with one
 * line and the close button, so a stale link never leaves the page in a
 * half state.
 */

const TITLE_ID = "user-modal-title";

export async function UserModal({ userId }: { userId: string | undefined }) {
  await requireAdminPage();
  if (!userId) return null;

  if (!isUuid(userId)) {
    return <NotFound />;
  }

  const supabase = await createClient();
  const detail = await getUserDetail(supabase, userId);
  if (!detail) return <NotFound />;

  return (
    <Modal key={detail.user.id} titleId={TITLE_ID} param="user" title={<Header detail={detail} />}>
      <OrdersSection detail={detail} />
    </Modal>
  );
}

function NotFound() {
  return (
    <Modal
      titleId={TITLE_ID}
      param="user"
      title={
        <h2 id={TITLE_ID} className="font-serif text-xl text-navy">
          User
        </h2>
      }
    >
      <p className="text-[0.95rem] text-navy-soft">This user is not on record.</p>
    </Modal>
  );
}

function Header({ detail }: { detail: AdminUserDetail }) {
  const { user } = detail;
  return (
    <div>
      <p className="text-[0.68rem] font-medium uppercase tracking-[0.28em] text-gold-dark">User</p>
      <h2 id={TITLE_ID} className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-serif text-xl leading-snug text-navy">
        <span className="truncate">{user.email}</span>
        {user.role === "admin" && <Pill tone="navy">Admin</Pill>}
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[0.85rem] sm:grid-cols-4">
        <Fact label="Full name" value={user.full_name || "Not given"} />
        <Fact label="Phone" value={user.phone || "Not given"} />
        <Fact label="Joined" value={formatDate(user.created_at)} />
        <Fact label="Role" value={user.role === "admin" ? "Admin" : "Client"} />
      </dl>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-navy-muted">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-navy">{value}</dd>
    </div>
  );
}

function stageLabel(detail: AdminUserDetail, order: AdminOrderRow): string {
  if (order.completed_at) return "Completed";
  return detail.stages.find((s) => s.service_id === order.service_id && s.key === order.stage_key)?.label ?? humanizeKey(order.stage_key);
}

function OrdersSection({ detail }: { detail: AdminUserDetail }) {
  const { orders } = detail;
  const paid = orders.filter((o) => o.paid_at).length;

  return (
    <section aria-labelledby="user-orders-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="user-orders-heading" className="text-xs font-medium uppercase tracking-[0.18em] text-navy-muted">
          Orders
        </h3>
        {orders.length > 0 && (
          <p className="text-[0.8rem] text-navy-muted">
            {formatCount(orders.length)} in total, {formatCount(paid)} paid
          </p>
        )}
      </div>

      {orders.length === 0 ? (
        <p className="mt-3 text-[0.9rem] text-navy-muted">No orders yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-navy/10 bg-white">
          <table className="w-full min-w-[40rem] border-collapse text-left text-[0.85rem]">
            <caption className="sr-only">Orders of this user</caption>
            <thead>
              <tr className="border-b border-navy/10 bg-paper">
                <Th>Service</Th>
                <Th>Ordered on</Th>
                <Th align="right">Amount</Th>
                <Th>Paid on</Th>
                <Th>Stage</Th>
                <Th align="right">Documents</Th>
                <th scope="col" className="px-4 py-2.5">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-navy/5 last:border-b-0">
                  <td className="px-4 py-3 align-top font-medium text-navy">
                    {order.service_name}
                  </td>
                  <td className="px-4 py-3 align-top text-navy">{formatDate(order.created_at)}</td>
                  <td className="px-4 py-3 text-right align-top tabular-nums text-navy">{formatEuro(order.total_cents)}</td>
                  <td className="px-4 py-3 align-top">
                    <PaidOn paidAt={order.paid_at} formatDate={formatDate} />
                  </td>
                  <td className="px-4 py-3 align-top text-navy">{stageLabel(detail, order)}</td>
                  <td className="px-4 py-3 text-right align-top tabular-nums text-navy">
                    {order.paid_at ? (
                      <span className="inline-flex items-center gap-2">
                        {order.docs_uploaded > 0 && <Pill tone="gold">{order.docs_uploaded} to review</Pill>}
                        <span>
                          {order.docs_approved}/{order.docs_required}
                        </span>
                      </span>
                    ) : (
                      <span className="text-navy-muted">0/{order.docs_required}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <Link
                      href={`/admin/orders?order=${order.id}`}
                      aria-label={`Open order for ${order.service_name} of ${formatDate(order.created_at)}`}
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm font-medium text-navy underline-offset-4 hover:text-gold-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                    >
                      Open
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      scope="col"
      className={
        align === "right"
          ? "px-4 py-2.5 text-right text-[0.68rem] font-medium uppercase tracking-[0.14em] text-navy-muted"
          : "px-4 py-2.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-navy-muted"
      }
    >
      {children}
    </th>
  );
}
