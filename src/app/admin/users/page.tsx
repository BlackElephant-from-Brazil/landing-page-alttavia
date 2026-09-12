import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, Pill, type Column } from "@/components/admin/data-table";
import { formatCount, formatDate } from "@/components/admin/lib/format";
import { firstParam, hrefWith, intParam, type SearchParams } from "@/components/admin/lib/params";
import { applyButtonClass } from "@/components/admin/range-controls";
import { UserModal } from "@/components/admin/user-modal";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import { listUsers } from "@/lib/db/admin-queries";
import type { AdminUserRow } from "@/lib/db/types";
import { requireAdminPage } from "@/lib/supabase/admin-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Users" };

/**
 * /admin/users: every profile in `public.users`, newest activity first,
 * searched by email through the URL (`?q=`, a GET form) and paginated.
 * Each row opens the user modal with `?user=<id>`, which lists that
 * person's orders and links each one to the orders page with its modal
 * open. Read with the user client; RLS `is_admin()` decides.
 */

const PATH = "/admin/users";
const PAGE_SIZE = 25;

type Props = {
  searchParams: Promise<SearchParams>;
};

export default async function UsersPage({ searchParams }: Props) {
  await requireAdminPage();
  const params = await searchParams;
  const q = firstParam(params, "q");
  const page = intParam(params, "page", 1);
  const userId = firstParam(params, "user");

  const supabase = await createClient();
  const result = await listUsers(supabase, { q, page, pageSize: PAGE_SIZE });

  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const first = result.total === 0 ? 0 : (current - 1) * PAGE_SIZE + 1;
  const last = Math.min(result.total, current * PAGE_SIZE);

  const columns: Column<AdminUserRow>[] = [
    {
      key: "email",
      header: "Email",
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-medium">{row.email}</span>
          {row.role === "admin" && <Pill tone="navy">Admin</Pill>}
        </span>
      ),
    },
    { key: "name", header: "Name", cell: (row) => row.full_name || <span className="text-navy-muted">Not given</span> },
    { key: "joined", header: "Joined on", cell: (row) => formatDate(row.created_at) },
    { key: "orders", header: "Orders", align: "right", cell: (row) => formatCount(row.orders_count) },
    { key: "paid", header: "Paid", align: "right", cell: (row) => formatCount(row.paid_count) },
    {
      key: "last",
      header: "Last order",
      cell: (row) => (row.last_order_at ? formatDate(row.last_order_at) : <span className="text-navy-muted">None</span>),
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <EyebrowSolo>Alttavia · Admin</EyebrowSolo>
        <h1 className="mt-4 font-serif text-[clamp(1.8rem,4vw,2.5rem)] leading-tight text-navy">Users</h1>
        <p className="mt-2 text-[0.9rem] text-navy-muted">Everyone with an account, most recent activity first.</p>
      </header>

      <form method="get" action={PATH} aria-label="Search" className="rounded-lg border border-navy/10 bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[16rem] flex-1 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-navy-muted">
            Email
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="name@example.com"
              autoComplete="off"
              className={cn(
                "mt-1 block h-9 w-full rounded-full border border-navy/15 bg-white px-3 text-[0.85rem] normal-case tracking-normal text-navy",
                "hover:border-navy/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
              )}
            />
          </label>
          <button type="submit" className={applyButtonClass}>
            Search
          </button>
          {q && (
            <Link href={PATH} className="text-[0.82rem] font-medium text-navy-soft underline-offset-4 hover:text-navy hover:underline">
              Clear
            </Link>
          )}
          <p className="ml-auto text-[0.82rem] text-navy-muted">
            {result.total === 0 ? "No users match." : `${first} to ${last} of ${formatCount(result.total)}`}
          </p>
        </div>
      </form>

      <DataTable
        caption="Users"
        columns={columns}
        rows={result.rows}
        rowKey={(row) => row.id}
        rowHref={(row) => hrefWith(PATH, params, { user: row.id })}
        rowLabel={(row) => `Open ${row.email}`}
        empty={q ? "No user matches this email." : "No users yet."}
      />

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-4 text-[0.85rem]">
          <PageLink params={params} page={current - 1} disabled={current <= 1}>
            Previous
          </PageLink>
          <span className="text-navy-muted">
            Page {current} of {pages}
          </span>
          <PageLink params={params} page={current + 1} disabled={current >= pages}>
            Next
          </PageLink>
        </nav>
      )}

      <UserModal userId={userId} />
    </div>
  );
}

function PageLink({
  params,
  page,
  disabled,
  children,
}: {
  params: SearchParams;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const className = cn(
    "inline-flex h-9 items-center rounded-full border px-4 font-medium transition-colors duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
    disabled ? "cursor-default border-navy/10 text-navy-muted/60" : "border-navy/20 bg-white text-navy hover:border-navy hover:bg-navy hover:text-white",
  );
  if (disabled) {
    return (
      <span aria-disabled="true" className={className}>
        {children}
      </span>
    );
  }
  return (
    <Link href={hrefWith(PATH, params, { page: page === 1 ? null : String(page), user: null })} className={className}>
      {children}
    </Link>
  );
}
