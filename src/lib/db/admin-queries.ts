/**
 * Reads for the admin area. Contract (docs/admin-contract.md) section 5.
 *
 * Every helper takes a Supabase client first, like src/lib/db/queries.ts.
 * Admin pages pass the user client, so the `is_admin()` policies of
 * 0005_admin.sql decide what comes back; route handlers may pass the admin
 * client. None of these write.
 *
 * No query per row anywhere: the orders table reads the `admin_order_summary`
 * view, which computes the document counts in the database, and the joins
 * on documents and events use PostgREST's embedded selects.
 *
 * Database errors are thrown, not swallowed.
 */

import { summarizeAnswers } from "@/lib/apply/summary";

import { bucketByMonth, chartMonths, chartStart } from "./overview-months";
import type { Db } from "./queries";
import type {
  AdminDocumentRow,
  AdminOrderDetail,
  AdminOrderRow,
  AdminUserCounts,
  AdminUserDetail,
  AdminUserRow,
  OrderFilters,
  Overview,
  QuestionRow,
  ServiceDeliverableRow,
  ServiceDocRow,
  ServiceRow,
  ServiceStageRow,
  ServiceWithConfig,
  UserDocumentRow,
  UserFilters,
  UserRow,
  UserServiceApplicantRow,
  UserServiceContractRow,
  UserServiceDeliverableRow,
  UserServiceEventRow,
  UserServiceRow,
} from "./types";

function fail(where: string, error: { message: string }): never {
  throw new Error(`${where}: ${error.message}`);
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
/** listUsers reads at most this many profiles before sorting and paging them. */
const MAX_USERS = 2000;

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
 * The slice of a PostgREST filter builder that listOrders chains on. The
 * builder's own generics are too deep to constrain a type parameter with,
 * so the helper casts to this and back.
 */
type Filterable = {
  is(column: string, value: null): Filterable;
  not(column: string, operator: string, value: unknown): Filterable;
  eq(column: string, value: unknown): Filterable;
  ilike(column: string, pattern: string): Filterable;
  gte(column: string, value: string): Filterable;
  filter(column: string, operator: "lt" | "lte", value: string): Filterable;
};

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

  // The same filters twice: once for the page, once (head only) for the
  // total when the page is past the end.
  function filtered<T>(query: T): T {
    let q = query as unknown as Filterable;
    if (status === "open") q = q.is("paid_at", null);
    if (status === "paid") q = q.not("paid_at", "is", null).is("completed_at", null);
    if (status === "completed") q = q.not("completed_at", "is", null);

    if (filters.serviceSlug) q = q.eq("service_slug", filters.serviceSlug);

    const needle = filters.q ? emailNeedle(filters.q) : "";
    if (needle) q = q.ilike("user_email", `%${needle}%`);

    if (filters.from) q = q.gte(dateColumn, filters.from);
    if (filters.to) {
      const end = rangeEnd(filters.to);
      q = q.filter(dateColumn, end.op, end.value);
    }
    return q as unknown as T;
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await filtered(db.from("admin_order_summary").select("*", { count: "exact" }))
    .order(dateColumn, { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) {
    // PGRST103: the requested range starts past the last row (a page that
    // no longer exists after a filter change). Answer an empty page with the
    // real total so the pager can step back, instead of failing.
    if (error.code !== "PGRST103") fail("listOrders", error);
    const { count: total, error: countError } = await filtered(
      db.from("admin_order_summary").select("id", { count: "exact", head: true }),
    );
    if (countError) fail("listOrders", countError);
    return { rows: [], total: total ?? 0 };
  }

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

  const [user, service, stages, docs, documents, events, applicants, contract, templates, files, questions] =
    await Promise.all([
      db.from("users").select("id, email, full_name, phone").eq("id", order.user_id).maybeSingle(),
      db.from("services").select("*").eq("id", order.service_id).maybeSingle(),
      db.from("service_stages").select("*").eq("service_id", order.service_id).order("position"),
      db.from("service_docs").select("*").eq("service_id", order.service_id).order("position"),
      db.from("user_documents").select("*").eq("user_service_id", order.id).order("created_at"),
      db.from("user_service_events").select("*").eq("user_service_id", order.id).order("created_at"),
      db.from("user_service_applicants").select("*").eq("user_service_id", order.id).order("applicant_index"),
      db.from("user_service_contracts").select("*").eq("user_service_id", order.id).maybeSingle(),
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
    ["applicants", applicants],
    ["contract", contract],
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
    applicants: (applicants.data ?? []) as UserServiceApplicantRow[],
    contract: (contract.data as UserServiceContractRow | null) ?? null,
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

type PaidRow = Pick<UserServiceRow, "service_id" | "total_cents" | "paid_at"> & {
  services: Pick<ServiceRow, "slug" | "name" | "position"> | null;
};

type StageLabelRow = Pick<ServiceStageRow, "key" | "label" | "position">;

/**
 * The overview page. `range.from` and `range.to` use the same date columns
 * as listOrders, so a KPI tile and the orders table filtered the same way
 * agree: open orders by `created_at`, paid and completed by `paid_at`. The
 * in progress queue, the documents review queue and the pipeline by stage
 * ignore the range; the monthly charts always show the last six months.
 *
 * One query per aggregate: four counts that transfer no rows, one read of
 * the paid orders in the range (paid count, revenue and by service), one of
 * the paid orders of the last six months and one of the unpaid orders
 * created in them (by month), one of the open pipeline (by stage) plus the
 * stage labels, and the active services (so the by service chart lists
 * what sold nothing).
 */
export async function getOverview(db: Db, range: { from: string; to: string }): Promise<Overview> {
  const end = rangeEnd(range.to);
  const now = new Date();
  const months = chartMonths(now);
  const chartFrom = chartStart(now).toISOString();

  // The range on one column, as the two plain filters every query below
  // chains: `.gte(column, from).filter(column, end.op, end.value)`.
  const PAID_COLUMNS = "service_id, total_cents, paid_at, services(slug, name, position)";

  const [open, inProgress, completed, awaitingReview, paidInRange, paidRecent, openRecent, pipeline, stageLabels, services] =
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
        .is("completed_at", null),
      db
        .from("user_services")
        .select("id", { count: "exact", head: true })
        .not("completed_at", "is", null)
        .gte("paid_at", range.from)
        .filter("paid_at", end.op, end.value),
      db.from("user_documents").select("id", { count: "exact", head: true }).eq("status", "uploaded"),
      db
        .from("user_services")
        .select(PAID_COLUMNS)
        .gte("paid_at", range.from)
        .filter("paid_at", end.op, end.value),
      db.from("user_services").select(PAID_COLUMNS).gte("paid_at", chartFrom),
      db.from("user_services").select("created_at").is("paid_at", null).gte("created_at", chartFrom),
      db.from("user_services").select("stage_key").is("completed_at", null),
      db.from("service_stages").select("key, label, position").order("position"),
      db.from("services").select("slug, name, position").eq("active", true).order("position"),
    ]);

  for (const [where, result] of [
    ["open", open],
    ["in progress", inProgress],
    ["completed", completed],
    ["awaiting review", awaitingReview],
    ["paid in range", paidInRange],
    ["paid recent", paidRecent],
    ["open recent", openRecent],
    ["pipeline", pipeline],
    ["stage labels", stageLabels],
    ["services", services],
  ] as const) {
    if (result.error) fail(`getOverview ${where}`, result.error);
  }

  const paidRows = (paidInRange.data ?? []) as unknown as PaidRow[];
  const recentRows = (paidRecent.data ?? []) as unknown as PaidRow[];
  const openRows = (openRecent.data ?? []) as Pick<UserServiceRow, "created_at">[];

  // By service, in catalogue order. Every active service is listed, zero
  // filled, so the donut legend shows what sold nothing; an inactive one
  // appears only with orders.
  const byService = new Map<string, Overview["ordersByService"][number] & { position: number }>();
  for (const service of (services.data ?? []) as Pick<ServiceRow, "slug" | "name" | "position">[]) {
    byService.set(service.slug, { slug: service.slug, name: service.name, count: 0, revenueCents: 0, position: service.position });
  }
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

  // By month, zero filled: paid and revenue by paid_at, open by created_at.
  const ordersByMonth = bucketByMonth(months, recentRows, openRows);

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

  return {
    kpis: {
      openOrders: open.count ?? 0,
      paidOrders: paidRows.length,
      inProgressOrders: inProgress.count ?? 0,
      completedOrders: completed.count ?? 0,
      revenueCents: paidRows.reduce((sum, row) => sum + row.total_cents, 0),
      documentsAwaitingReview: awaitingReview.count ?? 0,
    },
    ordersByMonth,
    ordersByStage: stageOrder,
    ordersByService,
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

type UserJoinRow = UserRow & {
  user_services: Pick<UserServiceRow, "created_at" | "paid_at">[] | null;
};

function newest(...values: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  for (const value of values) {
    if (value && (!best || value > best)) best = value;
  }
  return best;
}

/**
 * The users table: every profile with what its orders add up to, sorted by
 * last activity (newest first), searched by email and paged. One query:
 * the profiles with their orders' two dates embedded. The aggregate and the
 * sort happen here because PostgREST cannot order by them; the read is
 * capped at MAX_USERS, far above what the firm holds. `total` is the count
 * of matching profiles.
 */
export async function listUsers(db: Db, filters: UserFilters = {}): Promise<{ rows: AdminUserRow[]; total: number }> {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(filters.pageSize ?? DEFAULT_PAGE_SIZE)));

  let query = db.from("users").select("*, user_services(created_at, paid_at)").order("created_at", { ascending: false }).limit(MAX_USERS);
  const needle = filters.q ? emailNeedle(filters.q) : "";
  if (needle) query = query.ilike("email", `%${needle}%`);

  const { data, error } = await query;
  if (error) fail("listUsers", error);

  const rows = ((data ?? []) as unknown as UserJoinRow[])
    .map(({ user_services, ...user }) => {
      const orders = user_services ?? [];
      const lastOrderAt = newest(...orders.map((o) => o.created_at));
      const lastPaidAt = newest(...orders.map((o) => o.paid_at));
      return {
        ...user,
        orders_count: orders.length,
        paid_count: orders.filter((o) => o.paid_at).length,
        last_order_at: lastOrderAt,
        last_activity_at: newest(user.created_at, lastOrderAt, lastPaidAt) ?? user.created_at,
      };
    })
    .sort((a, b) => (a.last_activity_at < b.last_activity_at ? 1 : a.last_activity_at > b.last_activity_at ? -1 : 0));

  const start = (page - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total: rows.length };
}

/**
 * Everything the user modal shows, or null when the id is unknown: the
 * profile, its orders from the summary view (newest first) and the stage
 * labels of the services those orders are on.
 */
export async function getUserDetail(db: Db, id: string): Promise<AdminUserDetail | null> {
  const { data: userData, error: userError } = await db.from("users").select("*").eq("id", id).maybeSingle();
  if (userError) fail("getUserDetail", userError);
  const user = userData as UserRow | null;
  if (!user) return null;

  const { data: orderData, error: orderError } = await db
    .from("admin_order_summary")
    .select("*")
    .eq("user_id", id)
    .order("created_at", { ascending: false });
  if (orderError) fail("getUserDetail orders", orderError);
  const orders = (orderData ?? []) as AdminOrderRow[];

  const serviceIds = [...new Set(orders.map((o) => o.service_id))];
  let stages: AdminUserDetail["stages"] = [];
  if (serviceIds.length > 0) {
    const { data: stageData, error: stageError } = await db
      .from("service_stages")
      .select("service_id, key, label")
      .in("service_id", serviceIds);
    if (stageError) fail("getUserDetail stages", stageError);
    stages = (stageData ?? []) as AdminUserDetail["stages"];
  }

  return { user, orders, stages };
}

/**
 * What a client account holds, counted before an admin deletes it, or null
 * when the id is unknown. The delete dialog reads it so the admin sees what
 * goes ("3 orders, 14 files and 1 agreement") before typing the email, and
 * the route logs it in the audit line.
 *
 * Counts only, no rows: one head request per table. Returned files are
 * counted where they reached the bucket (`storage_key` set), so a slot the
 * firm opened and never filled is not called a file.
 */
export async function getUserDeletionCounts(db: Db, id: string): Promise<AdminUserCounts | null> {
  const { data: userData, error: userError } = await db.from("users").select("id").eq("id", id).maybeSingle();
  if (userError) fail("getUserDeletionCounts", userError);
  if (!userData) return null;

  const { data: orderData, error: orderError } = await db
    .from("user_services")
    .select("id, paid_at")
    .eq("user_id", id);
  if (orderError) fail("getUserDeletionCounts orders", orderError);
  const orders = (orderData ?? []) as Pick<UserServiceRow, "id" | "paid_at">[];
  const orderIds = orders.map((order) => order.id);

  type Counted = { count: number | null; error: { message: string } | null };

  /** A head request's count, or 0 when there is nothing to ask about. */
  async function counted(where: string, run: () => PromiseLike<Counted> | null): Promise<number> {
    const query = run();
    if (!query) return 0;
    const { count, error } = await query;
    if (error) fail(`getUserDeletionCounts ${where}`, error);
    return count ?? 0;
  }

  const byOrder = (table: string) =>
    orderIds.length === 0
      ? null
      : db.from(table).select("id", { count: "exact", head: true }).in("user_service_id", orderIds);

  const [documentCount, deliverableCount, agreementCount, answerCount] = await Promise.all([
    counted("documents", () => byOrder("user_documents")),
    counted("deliverables", () =>
      orderIds.length === 0
        ? null
        : db
            .from("user_service_deliverables")
            .select("id", { count: "exact", head: true })
            .in("user_service_id", orderIds)
            .not("storage_key", "is", null),
    ),
    counted("agreements", () => byOrder("user_service_contracts")),
    counted("answers", () => db.from("user_answers").select("id", { count: "exact", head: true }).eq("user_id", id)),
  ]);

  return {
    orders: orders.length,
    paidOrders: orders.filter((order) => order.paid_at).length,
    documents: documentCount,
    deliverables: deliverableCount,
    agreements: agreementCount,
    answers: answerCount,
    files: documentCount + deliverableCount + agreementCount,
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
