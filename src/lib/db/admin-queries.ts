/**
 * Reads for the admin area. Contract (docs/admin-contract.md) section 5.
 *
 * Every helper takes a Supabase client first, like src/lib/db/queries.ts.
 * Admin pages pass the user client, so the `is_admin()` policies of
 * 0005_admin.sql decide what comes back; route handlers may pass the admin
 * client. None of these write.
 *
 * No query per row anywhere: the orders table reads the `admin_order_summary`
 * view, which computes the document and pendency counts in the database, and
 * the joins on documents and events use PostgREST's embedded selects.
 *
 * Database errors are thrown, not swallowed.
 */

import { summarizeAnswers } from "@/lib/apply/summary";

import type { Db } from "./queries";
import type {
  AdminDocumentRow,
  AdminEventRow,
  AdminOrderDetail,
  AdminOrderRow,
  OrderFilters,
  Overview,
  QuestionRow,
  ServiceDeliverableRow,
  ServiceDocRow,
  ServiceRow,
  ServiceStageRow,
  ServiceWithConfig,
  UserDocumentRow,
  UserRow,
  UserServiceDeliverableRow,
  UserServiceEventRow,
  UserServiceNoteRow,
  UserServiceRow,
} from "./types";

function fail(where: string, error: { message: string }): never {
  throw new Error(`${where}: ${error.message}`);
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MONTHS_ON_CHART = 6;
const RECENT_EVENTS = 20;

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The day after a bare `YYYY-MM-DD`, so a `to` of "2026-09-30" includes the
 * whole of the 30th (`< 2026-10-01`) instead of stopping at its midnight.
 * A full timestamp is used as is.
 */
function rangeEnd(to: string): { op: "lt" | "lte"; value: string } {
  if (!BARE_DATE.test(to)) return { op: "lte", value: to };
  const next = new Date(`${to}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { op: "lt", value: next.toISOString().slice(0, 10) };
}

/**
 * The email search, reduced to what an email can contain. PostgREST reads
 * `,`, `(`, `)` and quotes as filter syntax and `%` and `_` are ILIKE
 * wildcards, so anything outside this set is dropped rather than escaped.
 */
function emailNeedle(q: string): string {
  return q.trim().toLowerCase().replace(/[^a-z0-9@.+_-]/g, "");
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

/**
 * The orders table: filtered, ordered and paginated in the database, with
 * the joined counts from the view. Open orders sort by `created_at`, the
 * rest by `paid_at`, newest first. `total` is the count before pagination.
 */
export async function listOrders(
  db: Db,
  filters: OrderFilters = {},
): Promise<{ rows: AdminOrderRow[]; total: number }> {
  const status = filters.status ?? "all";
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(filters.pageSize ?? DEFAULT_PAGE_SIZE)));
  const dateColumn = status === "paid" || status === "completed" ? "paid_at" : "created_at";

  let query = db.from("admin_order_summary").select("*", { count: "exact" });

  if (status === "open") query = query.is("paid_at", null);
  if (status === "paid") query = query.not("paid_at", "is", null).is("completed_at", null);
  if (status === "completed") query = query.not("completed_at", "is", null);

  if (filters.serviceSlug) query = query.eq("service_slug", filters.serviceSlug);

  const needle = filters.q ? emailNeedle(filters.q) : "";
  if (needle) query = query.ilike("user_email", `%${needle}%`);

  if (filters.from) query = query.gte(dateColumn, filters.from);
  if (filters.to) {
    const end = rangeEnd(filters.to);
    query = query.filter(dateColumn, end.op, end.value);
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order(dateColumn, { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) fail("listOrders", error);

  return { rows: (data ?? []) as AdminOrderRow[], total: count ?? 0 };
}

/**
 * Everything the order modal shows, or null when the id is unknown. Two
 * rounds: the order first (it names the client and the service), then every
 * dependent list in parallel.
 */
export async function getOrderDetail(db: Db, id: string): Promise<AdminOrderDetail | null> {
  const { data: orderData, error: orderError } = await db
    .from("user_services")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (orderError) fail("getOrderDetail", orderError);
  const order = orderData as UserServiceRow | null;
  if (!order) return null;

  const [user, service, stages, docs, documents, events, notes, templates, files, questions] =
    await Promise.all([
      db.from("users").select("id, email, full_name, phone").eq("id", order.user_id).maybeSingle(),
      db.from("services").select("*").eq("id", order.service_id).maybeSingle(),
      db.from("service_stages").select("*").eq("service_id", order.service_id).order("position"),
      db.from("service_docs").select("*").eq("service_id", order.service_id).order("position"),
      db.from("user_documents").select("*").eq("user_service_id", order.id).order("created_at"),
      db.from("user_service_events").select("*").eq("user_service_id", order.id).order("created_at"),
      db.from("user_service_notes").select("*").eq("user_service_id", order.id).order("created_at"),
      db.from("service_deliverables").select("*").eq("service_id", order.service_id).order("position"),
      db.from("user_service_deliverables").select("*").eq("user_service_id", order.id).order("created_at"),
      db.from("questions").select("*").eq("active", true).order("position"),
    ]);

  for (const [where, result] of [
    ["user", user],
    ["service", service],
    ["stages", stages],
    ["docs", docs],
    ["documents", documents],
    ["events", events],
    ["notes", notes],
    ["deliverable templates", templates],
    ["deliverables", files],
  ] as const) {
    if (result.error) fail(`getOrderDetail ${where}`, result.error);
  }
  if (!user.data) throw new Error(`getOrderDetail: order ${id} has no profile row`);
  if (!service.data) throw new Error(`getOrderDetail: order ${id} has no service row`);

  // Question rows only supply labels; without them the copy's labels serve.
  const questionRows = questions.error ? undefined : ((questions.data ?? []) as QuestionRow[]);
  const snapshot = order.answers_snapshot ?? {};
  const answers =
    Object.keys(snapshot).length === 0 ? [] : summarizeAnswers(snapshot, questionRows);

  return {
    order,
    user: user.data as Pick<UserRow, "id" | "email" | "full_name" | "phone">,
    service: service.data as ServiceRow,
    stages: (stages.data ?? []) as ServiceStageRow[],
    docs: (docs.data ?? []) as ServiceDocRow[],
    documents: (documents.data ?? []) as UserDocumentRow[],
    events: (events.data ?? []) as UserServiceEventRow[],
    notes: (notes.data ?? []) as UserServiceNoteRow[],
    deliverables: {
      templates: (templates.data ?? []) as ServiceDeliverableRow[],
      files: (files.data ?? []) as UserServiceDeliverableRow[],
    },
    answers,
  };
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

/** `YYYY-MM` in UTC. */
function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The first day of the month `MONTHS_ON_CHART - 1` months ago, in UTC. */
function chartStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS_ON_CHART - 1), 1));
}

/** The six month keys the chart shows, oldest first. */
function chartMonths(now: Date): string[] {
  const start = chartStart(now);
  return Array.from({ length: MONTHS_ON_CHART }, (_, i) =>
    monthKey(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1))),
  );
}

type PaidRow = Pick<UserServiceRow, "service_id" | "total_cents" | "paid_at"> & {
  services: Pick<ServiceRow, "slug" | "name" | "position"> | null;
};

type StageLabelRow = Pick<ServiceStageRow, "key" | "label" | "position">;

type EventJoinRow = UserServiceEventRow & {
  user_services: {
    users: Pick<UserRow, "email"> | null;
    services: Pick<ServiceRow, "name" | "slug"> | null;
  } | null;
};

/**
 * The overview page. `range.from` and `range.to` use the same date columns
 * as listOrders, so a KPI tile and the orders table filtered the same way
 * agree: open orders by `created_at`, paid and completed by `paid_at`. The
 * two review queues (documents, pendencies) and the pipeline by stage ignore
 * the range; the monthly chart always shows the last six months.
 *
 * One query per aggregate: five counts that transfer no rows, one read of
 * the paid orders in the range (revenue and by service), one of the paid
 * orders of the last six months (by month), one of the open pipeline (by
 * stage) plus the stage labels, and the last 20 events with their joins.
 */
export async function getOverview(db: Db, range: { from: string; to: string }): Promise<Overview> {
  const end = rangeEnd(range.to);
  const now = new Date();
  const months = chartMonths(now);
  const chartFrom = chartStart(now).toISOString();

  // The range on one column, as the two plain filters every query below
  // chains: `.gte(column, from).filter(column, end.op, end.value)`.
  const PAID_COLUMNS = "service_id, total_cents, paid_at, services(slug, name, position)";

  const [open, paid, completed, awaitingReview, pendencies, paidInRange, paidRecent, pipeline, stageLabels, events] =
    await Promise.all([
      db
        .from("user_services")
        .select("id", { count: "exact", head: true })
        .is("paid_at", null)
        .gte("created_at", range.from)
        .filter("created_at", end.op, end.value),
      db
        .from("user_services")
        .select("id", { count: "exact", head: true })
        .not("paid_at", "is", null)
        .is("completed_at", null)
        .gte("paid_at", range.from)
        .filter("paid_at", end.op, end.value),
      db
        .from("user_services")
        .select("id", { count: "exact", head: true })
        .not("completed_at", "is", null)
        .gte("paid_at", range.from)
        .filter("paid_at", end.op, end.value),
      db.from("user_documents").select("id", { count: "exact", head: true }).eq("status", "uploaded"),
      db
        .from("user_service_notes")
        .select("id", { count: "exact", head: true })
        .eq("audience", "client")
        .is("resolved_at", null),
      db
        .from("user_services")
        .select(PAID_COLUMNS)
        .gte("paid_at", range.from)
        .filter("paid_at", end.op, end.value),
      db.from("user_services").select(PAID_COLUMNS).gte("paid_at", chartFrom),
      db.from("user_services").select("stage_key").is("completed_at", null),
      db.from("service_stages").select("key, label, position").order("position"),
      db
        .from("user_service_events")
        .select("*, user_services!inner(users(email), services(name, slug))")
        .order("created_at", { ascending: false })
        .limit(RECENT_EVENTS),
    ]);

  for (const [where, result] of [
    ["open", open],
    ["paid", paid],
    ["completed", completed],
    ["awaiting review", awaitingReview],
    ["pendencies", pendencies],
    ["paid in range", paidInRange],
    ["paid recent", paidRecent],
    ["pipeline", pipeline],
    ["stage labels", stageLabels],
    ["events", events],
  ] as const) {
    if (result.error) fail(`getOverview ${where}`, result.error);
  }

  const paidRows = (paidInRange.data ?? []) as unknown as PaidRow[];
  const recentRows = (paidRecent.data ?? []) as unknown as PaidRow[];

  // By service, in catalogue order.
  const byService = new Map<string, Overview["ordersByService"][number] & { position: number }>();
  for (const row of paidRows) {
    const slug = row.services?.slug ?? row.service_id;
    const entry = byService.get(slug) ?? {
      slug,
      name: row.services?.name ?? slug,
      count: 0,
      revenueCents: 0,
      position: row.services?.position ?? Number.MAX_SAFE_INTEGER,
    };
    entry.count += 1;
    entry.revenueCents += row.total_cents;
    byService.set(slug, entry);
  }
  const ordersByService = [...byService.values()]
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    .map(({ slug, name, count, revenueCents }) => ({ slug, name, count, revenueCents }));

  // By month, zero filled.
  const byMonth = new Map(months.map((month) => [month, { month, paid: 0, revenueCents: 0 }]));
  for (const row of recentRows) {
    if (!row.paid_at) continue;
    const entry = byMonth.get(monthKey(new Date(row.paid_at)));
    if (!entry) continue;
    entry.paid += 1;
    entry.revenueCents += row.total_cents;
  }

  // By stage: every stage key the catalogue knows, in position order, with
  // the first label seen for it (services share keys and labels).
  const stageOrder: { stageKey: string; label: string; count: number }[] = [];
  const stageIndex = new Map<string, number>();
  for (const stage of (stageLabels.data ?? []) as StageLabelRow[]) {
    if (stageIndex.has(stage.key)) continue;
    stageIndex.set(stage.key, stageOrder.length);
    stageOrder.push({ stageKey: stage.key, label: stage.label, count: 0 });
  }
  for (const row of (pipeline.data ?? []) as Pick<UserServiceRow, "stage_key">[]) {
    const index = stageIndex.get(row.stage_key);
    if (index === undefined) {
      stageIndex.set(row.stage_key, stageOrder.length);
      stageOrder.push({ stageKey: row.stage_key, label: row.stage_key, count: 1 });
      continue;
    }
    stageOrder[index].count += 1;
  }

  const recentEvents: AdminEventRow[] = ((events.data ?? []) as unknown as EventJoinRow[]).map(
    ({ user_services, ...event }) => ({
      ...event,
      user_email: user_services?.users?.email ?? "",
      service_name: user_services?.services?.name ?? "",
      service_slug: user_services?.services?.slug ?? "",
    }),
  );

  return {
    kpis: {
      openOrders: open.count ?? 0,
      paidOrders: paid.count ?? 0,
      completedOrders: completed.count ?? 0,
      revenueCents: paidRows.reduce((sum, row) => sum + row.total_cents, 0),
      documentsAwaitingReview: awaitingReview.count ?? 0,
      openPendencies: pendencies.count ?? 0,
    },
    ordersByMonth: [...byMonth.values()],
    ordersByStage: stageOrder,
    ordersByService,
    recentEvents,
  };
}

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------

type DocumentJoinRow = UserDocumentRow & {
  service_docs: Pick<ServiceDocRow, "key" | "label"> | null;
  user_services: {
    users: Pick<UserRow, "email"> | null;
    services: Pick<ServiceRow, "name" | "slug"> | null;
  } | null;
};

/** Documents waiting for review, oldest upload first. */
export async function listPendingReviews(db: Db): Promise<AdminDocumentRow[]> {
  const { data, error } = await db
    .from("user_documents")
    .select("*, service_docs(key, label), user_services!inner(users(email), services(name, slug))")
    .eq("status", "uploaded")
    .order("uploaded_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) fail("listPendingReviews", error);

  return ((data ?? []) as unknown as DocumentJoinRow[]).map(({ service_docs, user_services, ...doc }) => ({
    ...doc,
    user_email: user_services?.users?.email ?? "",
    service_name: user_services?.services?.name ?? "",
    service_slug: user_services?.services?.slug ?? "",
    doc_key: service_docs?.key ?? "",
    doc_label: service_docs?.label ?? "",
  }));
}

// ---------------------------------------------------------------------------
// Services (editor)
// ---------------------------------------------------------------------------

const SERVICE_WITH_CONFIG = "*, service_stages(*), service_docs(*), service_deliverables(*), user_services(count)";

type ServiceJoinRow = ServiceRow & {
  service_stages: ServiceStageRow[];
  service_docs: ServiceDocRow[];
  service_deliverables: ServiceDeliverableRow[];
  user_services: { count: number }[];
};

function byPosition<T extends { position: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.position - b.position);
}

function toServiceWithConfig(row: ServiceJoinRow): ServiceWithConfig {
  const { service_stages, service_docs, service_deliverables, user_services, ...service } = row;
  return {
    ...service,
    stages: byPosition(service_stages ?? []),
    docs: byPosition(service_docs ?? []),
    deliverables: byPosition(service_deliverables ?? []),
    orders_count: user_services?.[0]?.count ?? 0,
  };
}

/** Every service, inactive ones included, with its configuration nested. */
export async function listServicesForAdmin(db: Db): Promise<ServiceWithConfig[]> {
  const { data, error } = await db.from("services").select(SERVICE_WITH_CONFIG).order("position");
  if (error) fail("listServicesForAdmin", error);
  return ((data ?? []) as unknown as ServiceJoinRow[]).map(toServiceWithConfig);
}

/** One service by id with its configuration, active or not. Null when unknown. */
export async function getServiceForAdmin(db: Db, id: string): Promise<ServiceWithConfig | null> {
  const { data, error } = await db.from("services").select(SERVICE_WITH_CONFIG).eq("id", id).maybeSingle();
  if (error) fail("getServiceForAdmin", error);
  return data ? toServiceWithConfig(data as unknown as ServiceJoinRow) : null;
}
