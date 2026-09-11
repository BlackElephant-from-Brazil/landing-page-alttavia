import type { Metadata } from "next";
import Link from "next/link";

import { MonthlyChart } from "@/components/admin/charts/monthly-chart";
import { ServiceChart } from "@/components/admin/charts/service-chart";
import { StageChart } from "@/components/admin/charts/stage-chart";
import { DataTable, Pill, type Column } from "@/components/admin/data-table";
import { KpiTiles } from "@/components/admin/kpi-tiles";
import { formatCount, formatDate, formatDateTime, humanizeKey } from "@/components/admin/lib/format";
import { firstParam, hrefWith, type SearchParams } from "@/components/admin/lib/params";
import { resolveRange } from "@/components/admin/lib/range";
import { OrderModal } from "@/components/admin/order-modal";
import { RangeControls } from "@/components/admin/range-controls";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { getOverview, listOrders, listPendingReviews } from "@/lib/db/admin-queries";
import type { AdminDocumentRow, AdminOrderRow } from "@/lib/db/types";
import { requireAdminPage } from "@/lib/supabase/admin-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Overview" };

/**
 * /admin, the overview. Contract (docs/admin-contract.md) section 7.
 *
 * The range comes from the URL (see src/components/admin/lib/range.ts) and
 * scopes the KPI tiles and the by service chart. The two work queues below
 * (orders in progress, documents to review) and the pipeline by stage are
 * not scoped by it: an order paid two months ago and still open is still
 * work. Everything is read with the user client; RLS `is_admin()` decides.
 *
 * `?order=<id>` opens the order modal on top of the page and is kept by
 * every link that does not change the range.
 */

const PATH = "/admin";
const IN_PROGRESS_PAGE_SIZE = 50;

type Props = {
  searchParams: Promise<SearchParams>;
};

export default async function OverviewPage({ searchParams }: Props) {
  await requireAdminPage();
  const params = await searchParams;
  const range = resolveRange(params);
  const orderId = firstParam(params, "order");

  const supabase = await createClient();
  const [overview, inProgress, pending] = await Promise.all([
    getOverview(supabase, { from: range.from, to: range.to }),
    listOrders(supabase, { status: "paid", pageSize: IN_PROGRESS_PAGE_SIZE }),
    listPendingReviews(supabase),
  ]);

  const stageLabels = new Map(overview.ordersByStage.map((s) => [s.stageKey, s.label]));
  const stageLabel = (key: string) => stageLabels.get(key) ?? humanizeKey(key);
  const orderHref = (id: string) => hrefWith(PATH, params, { order: id });

  const progressColumns: Column<AdminOrderRow>[] = [
    { key: "client", header: "Client", cell: (row) => <span className="font-medium">{row.user_email}</span> },
    { key: "service", header: "Service", cell: (row) => (row.quantity === 2 ? `${row.service_name} x2` : row.service_name) },
    { key: "paid", header: "Paid on", cell: (row) => formatDate(row.paid_at) },
    { key: "stage", header: "Stage", cell: (row) => stageLabel(row.stage_key) },
    {
      key: "docs",
      header: "Documents",
      align: "right",
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          {row.docs_uploaded > 0 && <Pill tone="gold">{row.docs_uploaded} to review</Pill>}
          {row.docs_rejected > 0 && <Pill tone="clay">{row.docs_rejected} rejected</Pill>}
          <span>
            {row.docs_approved}/{row.docs_required}
          </span>
        </span>
      ),
    },
    {
      key: "pendencies",
      header: "Pendencies",
      align: "right",
      cell: (row) => (row.open_pendencies > 0 ? <Pill tone="gold">{row.open_pendencies}</Pill> : <span className="text-navy-muted">0</span>),
    },
  ];

  const reviewColumns: Column<AdminDocumentRow>[] = [
    { key: "client", header: "Client", cell: (row) => <span className="font-medium">{row.user_email}</span> },
    { key: "service", header: "Service", cell: (row) => row.service_name },
    {
      key: "doc",
      header: "Document",
      cell: (row) => (
        <span>
          {row.doc_label || humanizeKey(row.doc_key)}
          {row.applicant_index === 1 && <span className="ml-2 text-[0.75rem] text-navy-muted">applicant 2</span>}
        </span>
      ),
    },
    { key: "file", header: "File", className: "max-w-[14rem] truncate", cell: (row) => row.file_name },
    { key: "uploaded", header: "Uploaded", cell: (row) => formatDateTime(row.uploaded_at ?? row.created_at) },
  ];

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-6">
        <div>
          <EyebrowSolo>Alttavia · Admin</EyebrowSolo>
          <h1 className="mt-4 font-serif text-[clamp(1.8rem,4vw,2.5rem)] leading-tight text-navy">Overview</h1>
          <p className="mt-2 text-[0.9rem] text-navy-muted">
            {range.label}: {formatDate(range.from)} to {formatDate(range.to)}.
          </p>
        </div>
        <RangeControls pathname={PATH} params={params} range={range} />
      </header>

      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="sr-only">
          Key figures
        </h2>
        <KpiTiles kpis={overview.kpis} rangeLabel={range.label} />
      </section>

      <section aria-labelledby="charts-heading">
        <h2 id="charts-heading" className="sr-only">
          Charts
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <MonthlyChart data={overview.ordersByMonth} />
          </div>
          <StageChart data={overview.ordersByStage} />
          <ServiceChart data={overview.ordersByService} />
        </div>
      </section>

      <section aria-labelledby="progress-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="progress-heading" className="font-serif text-xl text-navy">
            In progress
          </h2>
          <p className="text-[0.82rem] text-navy-muted">
            {inProgress.total > IN_PROGRESS_PAGE_SIZE
              ? `Newest ${IN_PROGRESS_PAGE_SIZE} of ${formatCount(inProgress.total)}. `
              : `${formatCount(inProgress.total)} paid, not yet complete. `}
            <Link href="/admin/orders?status=paid" className="font-medium text-navy underline-offset-4 hover:text-gold-dark hover:underline">
              All orders
            </Link>
          </p>
        </div>
        <DataTable
          className="mt-4"
          caption="Orders paid and in progress"
          columns={progressColumns}
          rows={inProgress.rows}
          rowKey={(row) => row.id}
          rowHref={(row) => orderHref(row.id)}
          rowLabel={(row) => `Open order for ${row.user_email}`}
          empty="No order in progress."
        />
      </section>

      <section aria-labelledby="review-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="review-heading" className="font-serif text-xl text-navy">
            Awaiting review
          </h2>
          <p className="text-[0.82rem] text-navy-muted">
            {pending.length === 0 ? "Nothing waiting." : `${formatCount(pending.length)} to review, oldest first.`}
          </p>
        </div>
        <DataTable
          className="mt-4"
          caption="Documents awaiting review"
          columns={reviewColumns}
          rows={pending}
          rowKey={(row) => row.id}
          rowHref={(row) => orderHref(row.user_service_id)}
          rowLabel={(row) => `Open order for ${row.user_email}`}
          empty="No document waiting for review."
        />
      </section>

      <section aria-labelledby="events-heading">
        <h2 id="events-heading" className="font-serif text-xl text-navy">
          Recent activity
        </h2>
        {overview.recentEvents.length === 0 ? (
          <p className="mt-3 text-[0.9rem] text-navy-muted">No stage changes yet.</p>
        ) : (
          <ol className="mt-4 divide-y divide-navy/5 rounded-lg border border-navy/10 bg-white shadow-[var(--shadow-soft)]">
            {overview.recentEvents.map((event) => (
              <li key={event.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 text-[0.85rem]">
                <span className="w-[9.5rem] shrink-0 tabular-nums text-navy-muted">{formatDateTime(event.created_at)}</span>
                <Link
                  href={orderHref(event.user_service_id)}
                  scroll={false}
                  className="rounded-sm font-medium text-navy underline-offset-4 hover:text-gold-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  {event.user_email || "Unknown client"}
                </Link>
                <span className="text-navy-soft">{event.service_name}</span>
                <span className="text-navy">
                  {event.from_stage
                    ? `${stageLabel(event.from_stage)} to ${stageLabel(event.to_stage)}`
                    : `Created on ${stageLabel(event.to_stage)}`}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <OrderModal orderId={orderId} />
    </div>
  );
}
