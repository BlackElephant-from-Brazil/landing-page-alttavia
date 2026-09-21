/**
 * Reads the client's order view needs beyond src/lib/db/queries.ts: the
 * deliverables that are ready, the principal's details the deeds are
 * filled with and the service agreement. Admin contract
 * (docs/admin-contract.md) section 7, "Client order view"; documents
 * contract section 3 for the applicants; agreement contract
 * (docs/agreement-contract.md) section 4 for the agreement.
 *
 * Same shape as queries.ts: the Supabase client comes first, so the user
 * client (RLS: `user_service_deliverables_select_own` shows ready rows on
 * own orders, `user_service_applicants` and `user_service_contracts` show
 * own rows) and the admin client both work. The filters are repeated here regardless, so a caller holding
 * the admin client cannot leak a pending upload to the client by mistake.
 *
 * Database errors are thrown; the pages decide what to do with them.
 */

import { documentCounts, progressFraction, type DocumentCounts, type Progress } from "@/components/dashboard/order-status";

import {
  getActiveQuestions,
  getOrderContract,
  getServiceDocs,
  getServiceStages,
  getUserDocuments,
  type Db,
} from "./queries";
import type {
  QuestionRow,
  ServiceDocRow,
  ServiceRow,
  ServiceStageRow,
  UserDocumentRow,
  UserServiceApplicantRow,
  UserServiceContractRow,
  UserServiceDeliverableRow,
  UserServiceRow,
} from "./types";

function fail(where: string, error: { message: string }): never {
  throw new Error(`${where}: ${error.message}`);
}

/**
 * The principal's details entered on one order, by applicant index (0 then
 * 1). Zero, one or two rows: a deed slot with no row for its applicant has
 * not been filled in yet. RLS limits the user client to the account's own
 * orders.
 */
export async function listOrderApplicants(db: Db, userServiceId: string): Promise<UserServiceApplicantRow[]> {
  const { data, error } = await db
    .from("user_service_applicants")
    .select("*")
    .eq("user_service_id", userServiceId)
    .order("applicant_index", { ascending: true });
  if (error) fail("listOrderApplicants", error);
  return (data ?? []) as UserServiceApplicantRow[];
}

/** Deliverables the firm has finished uploading on one order, oldest first. Pending rows never come back. */
export async function getReadyDeliverables(db: Db, orderId: string): Promise<UserServiceDeliverableRow[]> {
  const { data, error } = await db
    .from("user_service_deliverables")
    .select("*")
    .eq("user_service_id", orderId)
    .eq("status", "ready")
    .order("created_at", { ascending: true });
  if (error) fail("getReadyDeliverables", error);
  return (data ?? []) as UserServiceDeliverableRow[];
}

/** Every order of one user, newest first, any status. For the "Your orders" table. */
export async function getUserServicesForUser(db: Db, userId: string): Promise<UserServiceRow[]> {
  const { data, error } = await db
    .from("user_services")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) fail("getUserServicesForUser", error);
  return (data ?? []) as UserServiceRow[];
}

/** The service rows behind a list of orders, keyed by id. A deactivated service is missing for a client (RLS) and left out. */
export async function getServicesByIds(db: Db, ids: readonly string[]): Promise<Map<string, ServiceRow>> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return new Map();
  const { data, error } = await db.from("services").select("*").in("id", unique);
  if (error) fail("getServicesByIds", error);
  return new Map(((data ?? []) as ServiceRow[]).map((row) => [row.id, row]));
}

/** Everything the order view renders besides the order row itself. */
export type OrderViewData = {
  service: ServiceRow;
  stages: ServiceStageRow[];
  docs: ServiceDocRow[];
  documents: UserDocumentRow[];
  /** The principal's details entered so far, by applicant index; a deed slot reads its applicant's row here. */
  applicants: UserServiceApplicantRow[];
  /** The service agreement prepared for the order, or null while there is none. */
  contract: UserServiceContractRow | null;
  deliverables: UserServiceDeliverableRow[];
  /** Undefined when the questions could not be read; the answers summary then uses the copy's labels. */
  questions: QuestionRow[] | undefined;
};

/**
 * Loads what src/components/dashboard/order-view.tsx needs for one order,
 * in one round of parallel queries. Shared by /en/dashboard and
 * /en/dashboard/orders/[id], so the two pages cannot drift.
 *
 * Two reads are allowed to fail softly: the questions (labels only) and the
 * service row when RLS hides it because the service was deactivated after
 * the order was placed. The order still renders with its own total and a
 * neutral name rather than failing the page.
 */
export async function getOrderViewData(db: Db, order: UserServiceRow): Promise<OrderViewData> {
  const [serviceResult, stages, docs, documents, applicants, contract, deliverables, questions] = await Promise.all([
    db.from("services").select("*").eq("id", order.service_id).maybeSingle(),
    getServiceStages(db, order.service_id),
    getServiceDocs(db, order.service_id),
    getUserDocuments(db, order.id),
    listOrderApplicants(db, order.id),
    getOrderContract(db, order.id),
    getReadyDeliverables(db, order.id),
    getActiveQuestions(db).catch((err: unknown): QuestionRow[] | undefined => {
      console.error("getOrderViewData: questions unavailable, using the copy's labels:", err);
      return undefined;
    }),
  ]);
  if (serviceResult.error) fail("getOrderViewData service", serviceResult.error);
  const service = (serviceResult.data as ServiceRow | null) ?? fallbackService(order);

  return { service, stages, docs, documents, applicants, contract, deliverables, questions };
}

const FALLBACK_SERVICE_NAME = "Your order";

/**
 * A service row the catalogue no longer shows (deactivated after the order
 * was placed, so RLS hides it from the client). It names no contract: an
 * agreement already prepared still shows, because the order view reads the
 * contract row itself; a new one is not asked for.
 */
export function fallbackService(order: UserServiceRow): ServiceRow {
  return {
    id: order.service_id,
    slug: "",
    name: FALLBACK_SERVICE_NAME,
    tagline: null,
    description: null,
    price_cents: order.total_cents,
    currency: order.currency,
    includes: [],
    timeline: null,
    contract_template: null,
    stripe_price_id_test: null,
    stripe_price_id_live: null,
    stripe_payment_link_test: null,
    stripe_payment_link_live: null,
    position: 0,
    active: false,
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}

// ---------------------------------------------------------------------------
// The order list behind the dashboard home and the purchases page: every
// order of the account with the few joined facts a row or a progress card
// shows. Read through the user client, so RLS limits every table to the
// account's own rows and the active catalogue.
// ---------------------------------------------------------------------------


const FALLBACK_STAGE_LABEL = "In progress";

/** One order as the tables and the slider show it. */
export type ClientOrderSummary = {
  order: UserServiceRow;
  /** The service row, or a stand in when the catalogue no longer shows it. */
  service: ServiceRow;
  /** Label of the order's current stage; a neutral one when the key is unknown. */
  stageLabel: string;
  progress: Progress;
  docs: DocumentCounts;
  /** Files the firm returned and finished uploading. */
  deliverables: number;
};

/**
 * Every order of one user, newest first, each with its service, stage
 * label, progress, document counts and ready deliverables. Five queries in
 * two rounds, whatever the number of orders; the counting is done here with
 * the same slot rules the order view uses.
 */
export async function listOrdersForUser(db: Db, userId: string): Promise<ClientOrderSummary[]> {
  const orders = await getUserServicesForUser(db, userId);
  if (orders.length === 0) return [];

  const serviceIds = Array.from(new Set(orders.map((o) => o.service_id)));
  const orderIds = orders.map((o) => o.id);

  const [services, stagesResult, docsResult, documentsResult, deliverablesResult] = await Promise.all([
    getServicesByIds(db, serviceIds),
    db.from("service_stages").select("*").in("service_id", serviceIds),
    db.from("service_docs").select("*").in("service_id", serviceIds),
    db.from("user_documents").select("*").in("user_service_id", orderIds),
    db
      .from("user_service_deliverables")
      .select("id, user_service_id")
      .in("user_service_id", orderIds)
      .eq("status", "ready"),
  ]);
  if (stagesResult.error) fail("listOrdersForUser stages", stagesResult.error);
  if (docsResult.error) fail("listOrdersForUser docs", docsResult.error);
  if (documentsResult.error) fail("listOrdersForUser documents", documentsResult.error);
  if (deliverablesResult.error) fail("listOrdersForUser deliverables", deliverablesResult.error);

  const stagesByService = groupBy((stagesResult.data ?? []) as ServiceStageRow[], (s) => s.service_id);
  const docsByService = groupBy((docsResult.data ?? []) as ServiceDocRow[], (d) => d.service_id);
  const documentsByOrder = groupBy((documentsResult.data ?? []) as UserDocumentRow[], (d) => d.user_service_id);
  const deliverablesByOrder = countBy((deliverablesResult.data ?? []) as { user_service_id: string }[], (d) => d.user_service_id);

  return orders.map((order) => {
    const service = services.get(order.service_id) ?? fallbackService(order);
    const stages = stagesByService.get(order.service_id) ?? [];
    const completed = !!order.completed_at;
    const stage = stages.find((s) => s.key === order.stage_key);
    return {
      order,
      service,
      stageLabel: stage?.label ?? FALLBACK_STAGE_LABEL,
      progress: progressFraction(stages, order.stage_key, completed),
      docs: documentCounts(docsByService.get(order.service_id) ?? [], documentsByOrder.get(order.id) ?? [], order.applicants),
      deliverables: deliverablesByOrder.get(order.id) ?? 0,
    };
  });
}

/** The document slots of several services at once, keyed by service id, each list in position order. */
export async function getServiceDocsForServices(db: Db, serviceIds: readonly string[]): Promise<Map<string, ServiceDocRow[]>> {
  const unique = Array.from(new Set(serviceIds));
  if (unique.length === 0) return new Map();
  const { data, error } = await db
    .from("service_docs")
    .select("*")
    .in("service_id", unique)
    .order("position", { ascending: true });
  if (error) fail("getServiceDocsForServices", error);
  return groupBy((data ?? []) as ServiceDocRow[], (d) => d.service_id);
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = out.get(k);
    if (list) list.push(row);
    else out.set(k, [row]);
  }
  return out;
}

function countBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}
