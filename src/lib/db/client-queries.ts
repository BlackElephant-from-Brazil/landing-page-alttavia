/**
 * Reads the client's order view needs beyond src/lib/db/queries.ts: the
 * notes the firm posted for the client and the deliverables that are ready.
 * Admin contract (docs/admin-contract.md) section 7, "Client order view".
 *
 * Same shape as queries.ts: the Supabase client comes first, so the user
 * client (RLS: `user_service_notes_select` shows audience client rows on own
 * orders, `user_service_deliverables_select_own` shows ready rows) and the
 * admin client both work. The filters are repeated here regardless, so a
 * caller holding the admin client cannot leak an internal note or a pending
 * upload to the client by mistake.
 *
 * Database errors are thrown; the pages decide what to do with them.
 */

import { getActiveQuestions, getServiceDocs, getServiceStages, getUserDocuments, type Db } from "./queries";
import type {
  QuestionRow,
  ServiceDocRow,
  ServiceRow,
  ServiceStageRow,
  UserDocumentRow,
  UserServiceDeliverableRow,
  UserServiceNoteRow,
  UserServiceRow,
} from "./types";

function fail(where: string, error: { message: string }): never {
  throw new Error(`${where}: ${error.message}`);
}

/** Notes addressed to the client on one order, oldest first. Internal notes never come back. */
export async function getClientNotes(db: Db, orderId: string): Promise<UserServiceNoteRow[]> {
  const { data, error } = await db
    .from("user_service_notes")
    .select("*")
    .eq("user_service_id", orderId)
    .eq("audience", "client")
    .order("created_at", { ascending: true });
  if (error) fail("getClientNotes", error);
  return (data ?? []) as UserServiceNoteRow[];
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
  notes: UserServiceNoteRow[];
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
  const [serviceResult, stages, docs, documents, notes, deliverables, questions] = await Promise.all([
    db.from("services").select("*").eq("id", order.service_id).maybeSingle(),
    getServiceStages(db, order.service_id),
    getServiceDocs(db, order.service_id),
    getUserDocuments(db, order.id),
    getClientNotes(db, order.id),
    getReadyDeliverables(db, order.id),
    getActiveQuestions(db).catch((err: unknown): QuestionRow[] | undefined => {
      console.error("getOrderViewData: questions unavailable, using the copy's labels:", err);
      return undefined;
    }),
  ]);
  if (serviceResult.error) fail("getOrderViewData service", serviceResult.error);
  const service = (serviceResult.data as ServiceRow | null) ?? fallbackService(order);

  return { service, stages, docs, documents, notes, deliverables, questions };
}

const FALLBACK_SERVICE_NAME = "Your order";

/**
 * A service row the catalogue no longer shows (deactivated after the order
 * was placed, so RLS hides it from the client).
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
    supports_quantity: false,
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
