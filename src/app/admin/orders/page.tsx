import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, PaidOn, Pill, type Column } from "@/components/admin/data-table";
import { formatCount, formatDate, formatEuro, humanizeKey } from "@/components/admin/lib/format";
import { firstParam, hrefWith, intParam, type SearchParams } from "@/components/admin/lib/params";
import { RANGE_KEYS, RANGE_LABELS, isRangeKey, resolveRange } from "@/components/admin/lib/range";
import { OrderModal } from "@/components/admin/order-modal";
import { KanbanBoard, type KanbanCardData } from "@/components/admin/orders/kanban-board";
import { KANBAN_LIMIT, capOrders, kanbanColumns } from "@/components/admin/orders/kanban-model";
import { ViewSwitch, viewFromParam } from "@/components/admin/orders/view-switch";
import { applyButtonClass, dateInputClass } from "@/components/admin/range-controls";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import { listOrders, listServicesForAdmin } from "@/lib/db/admin-queries";
import { listOrdersForBoard } from "@/lib/db/kanban-queries";
import type { AdminOrderRow, OrderStatusFilter } from "@/lib/db/types";
import { requireAdminPage } from "@/lib/supabase/admin-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Orders" };

/**
 * /admin/orders. Contract (docs/admin-contract.md) section 7: every order,
 * filtered by status, service, range and email through the URL (a GET
 * form, so the back button and a shared link keep the view), each order
 * opening the order modal with `?order=`.
 *
 * Two views of the same list. The board (`kanban`) is what the page opens
 * on, always: nothing about the view is stored, so `?view=table` is the
 * only way to see the table and it lives in the URL like the filters. The
 * filters apply to both; only the reading differs. The table pages 25 at a
 * time, the board draws the newest KANBAN_LIMIT matches at once and says
 * so when it leaves any out.
 *
 * The range applies to `created_at` for open orders and to `paid_at` for
 * paid and completed ones, the same rule listOrders, listOrdersForBoard and
 * the overview use. Unlike the overview, the range here is only applied
 * when the URL names one: with nothing set, both views show everything.
 */

const PATH = "/admin/orders";
const PAGE_SIZE = 25;

const STATUS_OPTIONS: { value: OrderStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open, unpaid" },
  { value: "paid", label: "Paid, in progress" },
  { value: "completed", label: "Completed" },
];

const copy = {
  capped: `Showing the newest ${KANBAN_LIMIT}. Use the filters to narrow the list.`,
  dragHint: "Drag a card to another column to move the order on. Unpaid orders wait for payment first.",
} as const;

function statusParam(value: string | undefined): OrderStatusFilter {
  return STATUS_OPTIONS.some((o) => o.value === value) ? (value as OrderStatusFilter) : "all";
}

type Props = {
  searchParams: Promise<SearchParams>;
};

export default async function OrdersPage({ searchParams }: Props) {
  await requireAdminPage();
  const params = await searchParams;
  const status = statusParam(firstParam(params, "status"));
  const serviceSlug = firstParam(params, "service");
  const q = firstParam(params, "q");
  const page = intParam(params, "page", 1);
  const orderId = firstParam(params, "order");
  const view = viewFromParam(firstParam(params, "view"));

  const range = resolveRange(params);
  const rangeKey = firstParam(params, "range");
  const rangeRequested = range.key === "custom" || isRangeKey(rangeKey);

  const filters = {
    status,
    serviceSlug: safeSlug(serviceSlug),
    q,
    from: rangeRequested ? range.from : undefined,
    to: rangeRequested ? range.to : undefined,
  };

  const supabase = await createClient();
  const [services, table, board] = await Promise.all([
    listServicesForAdmin(supabase),
    view === "table" ? listOrders(supabase, { ...filters, page, pageSize: PAGE_SIZE }) : null,
    view === "kanban" ? listOrdersForBoard(supabase, { ...filters, limit: KANBAN_LIMIT }) : null,
  ]);

  const knownService = services.some((s) => s.slug === serviceSlug) ? serviceSlug : undefined;
  const stageLabels = new Map<string, string>();
  for (const service of services) {
    for (const stage of service.stages) if (!stageLabels.has(stage.key)) stageLabels.set(stage.key, stage.label);
  }
  const stageLabel = (key: string) => stageLabels.get(key) ?? humanizeKey(key);

  // The board: the catalogue's stages as columns, the matching orders as
  // cards already formatted, so the client component draws no dates or money.
  const columns = kanbanColumns(services);
  const capped = capOrders(board?.rows ?? [], board?.total ?? 0, KANBAN_LIMIT);
  const cards: KanbanCardData[] = capped.rows.map((row) => ({
    id: row.id,
    href: hrefWith(PATH, params, { order: row.id }),
    stageKey: row.stage_key,
    userEmail: row.user_email,
    userName: row.user_name,
    serviceName: row.service_name,
    amount: formatEuro(row.total_cents),
    paid: row.paid_at !== null,
    paidOn: row.paid_at ? formatDate(row.paid_at) : null,
    completed: row.completed_at !== null,
    dateLabel: row.paid_at ? `Paid ${formatDate(row.paid_at)}` : `Created ${formatDate(row.created_at)}`,
    docsRequired: row.docs_required,
    docsApproved: row.docs_approved,
    docsUploaded: row.docs_uploaded,
  }));

  const total = view === "table" ? (table?.total ?? 0) : (board?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const first = total === 0 ? 0 : (current - 1) * PAGE_SIZE + 1;
  const last = Math.min(total, current * PAGE_SIZE);
  const countLine =
    total === 0
      ? "No orders match."
      : view === "table"
        ? `${first} to ${last} of ${formatCount(total)}`
        : `${formatCount(total)} ${total === 1 ? "order" : "orders"}`;

  const columnsForTable: Column<AdminOrderRow>[] = [
    { key: "client", header: "Client", cell: (row) => <span className="font-medium">{row.user_email}</span> },
    { key: "service", header: "Service", cell: (row) => row.service_name },
    { key: "amount", header: "Amount", align: "right", cell: (row) => formatEuro(row.total_cents) },
    {
      key: "status",
      header: "Status",
      cell: (row) =>
        row.completed_at ? <Pill tone="navy">Completed</Pill> : row.paid_at ? <Pill tone="gold">Paid</Pill> : <Pill tone="muted">Open</Pill>,
    },
    { key: "date", header: "Created", cell: (row) => formatDate(row.created_at) },
    { key: "paid", header: "Paid on", cell: (row) => <PaidOn paidAt={row.paid_at} formatDate={formatDate} /> },
    { key: "stage", header: "Stage", cell: (row) => stageLabel(row.stage_key) },
    {
      key: "docs",
      header: "Documents",
      align: "right",
      cell: (row) =>
        row.paid_at ? (
          <span className="inline-flex items-center gap-2">
            {row.docs_uploaded > 0 && <Pill tone="gold">{row.docs_uploaded} to review</Pill>}
            <span>
              {row.docs_approved}/{row.docs_required}
            </span>
          </span>
        ) : (
          <span className="text-navy-muted">0/{row.docs_required}</span>
        ),
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <EyebrowSolo>Alttavia · Admin</EyebrowSolo>
          <h1 className="mt-4 font-serif text-[clamp(1.8rem,4vw,2.5rem)] leading-tight text-navy">Orders</h1>
        </div>
        <ViewSwitch
          view={view}
          kanbanHref={hrefWith(PATH, params, { view: null })}
          tableHref={hrefWith(PATH, params, { view: "table" })}
        />
      </header>

      <form method="get" action={PATH} aria-label="Filters" className="rounded-lg border border-navy/10 bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5">
        {/* The view is a filter as far as the form is concerned: without it a
            search from the table would answer on the board. */}
        {view === "table" && <input type="hidden" name="view" value="table" />}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto_auto]">
          <label className={filterLabelClass}>
            Status
            <select name="status" defaultValue={status} className={filterFieldClass}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={filterLabelClass}>
            Service
            <select name="service" defaultValue={knownService ?? ""} className={filterFieldClass}>
              <option value="">Any service</option>
              {services.map((service) => (
                <option key={service.id} value={service.slug}>
                  {service.name}
                  {service.active ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          </label>
          <label className={filterLabelClass}>
            Email
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="name@example.com"
              autoComplete="off"
              className={filterFieldClass}
            />
          </label>
          <label className={filterLabelClass}>
            Range
            <select
              name="range"
              defaultValue={range.key === "custom" || !isRangeKey(rangeKey) ? "" : rangeKey}
              className={filterFieldClass}
            >
              <option value="">Any time</option>
              {RANGE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {RANGE_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <label className={filterLabelClass}>
              From
              <input type="date" name="from" defaultValue={range.key === "custom" ? range.from : ""} className={dateInputClass} />
            </label>
            <label className={filterLabelClass}>
              To
              <input type="date" name="to" defaultValue={range.key === "custom" ? range.to : ""} className={dateInputClass} />
            </label>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" className={applyButtonClass}>
            Apply filters
          </button>
          <Link
            href={view === "table" ? `${PATH}?view=table` : PATH}
            className="text-[0.82rem] font-medium text-navy-soft underline-offset-4 hover:text-navy hover:underline"
          >
            Clear
          </Link>
          <p className="ml-auto text-[0.82rem] text-navy-muted">{countLine}</p>
        </div>
      </form>

      {view === "kanban" ? (
        <section aria-label="Orders by stage" className="space-y-3">
          <p className="text-[0.82rem] text-navy-muted">{capped.hidden > 0 ? copy.capped : copy.dragHint}</p>
          <KanbanBoard columns={columns} cards={cards} />
        </section>
      ) : (
        <>
          <DataTable
            caption="Orders"
            columns={columnsForTable}
            rows={table?.rows ?? []}
            rowKey={(row) => row.id}
            rowHref={(row) => hrefWith(PATH, params, { order: row.id })}
            rowLabel={(row) => `Open order for ${row.user_email}`}
            empty="No orders match these filters."
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
        </>
      )}

      <OrderModal orderId={orderId} />
    </div>
  );
}

/** A slug is lower kebab; anything else is not looked up. */
function safeSlug(slug: string | undefined): string | undefined {
  return slug && /^[a-z0-9-]{1,60}$/.test(slug) ? slug : undefined;
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
    <Link href={hrefWith(PATH, params, { page: page === 1 ? null : String(page), order: null })} className={className}>
      {children}
    </Link>
  );
}

const filterLabelClass = "block text-[0.7rem] font-medium uppercase tracking-[0.14em] text-navy-muted";
const filterFieldClass = cn(
  "mt-1 block h-9 w-full rounded-full border border-navy/15 bg-white px-3 text-[0.85rem] normal-case tracking-normal text-navy",
  "hover:border-navy/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
);
