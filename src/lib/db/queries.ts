/**
 * Shared reads over the tables in src/lib/db/types.ts. Contract section 7.
 *
 * Every helper takes the Supabase client as its first argument, so the same
 * function serves the user client (row level security decides what comes
 * back) and the admin client (secret key, sees everything). None of them
 * writes: inserts and updates happen in route handlers with the admin client
 * after the session has been checked.
 *
 * Database errors are thrown, not swallowed. The callers decide whether to
 * fall back to the copies the code keeps.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  QuestionRow,
  ServiceDocRow,
  ServiceRow,
  ServiceStageRow,
  UserDocumentRow,
  UserServiceContractRow,
  UserServiceEventRow,
  UserServiceRow,
} from "./types";

/** Any Supabase client: browser, server (cookies) or admin (secret key). */
export type Db = SupabaseClient;

function fail(where: string, error: { message: string }): never {
  throw new Error(`${where}: ${error.message}`);
}

/** Active questions of the initial form, in position order. */
export async function getActiveQuestions(db: Db): Promise<QuestionRow[]> {
  const { data, error } = await db
    .from("questions")
    .select("*")
    .eq("active", true)
    .order("position", { ascending: true });
  if (error) fail("getActiveQuestions", error);
  return (data ?? []) as QuestionRow[];
}

/** Active services, in position order. */
export async function getActiveServices(db: Db): Promise<ServiceRow[]> {
  const { data, error } = await db
    .from("services")
    .select("*")
    .eq("active", true)
    .order("position", { ascending: true });
  if (error) fail("getActiveServices", error);
  return (data ?? []) as ServiceRow[];
}

/** One service by slug (a ProductId), active or not. Null when unknown. */
export async function getServiceBySlug(db: Db, slug: string): Promise<ServiceRow | null> {
  const { data, error } = await db.from("services").select("*").eq("slug", slug).maybeSingle();
  if (error) fail("getServiceBySlug", error);
  return (data as ServiceRow | null) ?? null;
}

/** A service's lifecycle, in position order. */
export async function getServiceStages(db: Db, serviceId: string): Promise<ServiceStageRow[]> {
  const { data, error } = await db
    .from("service_stages")
    .select("*")
    .eq("service_id", serviceId)
    .order("position", { ascending: true });
  if (error) fail("getServiceStages", error);
  return (data ?? []) as ServiceStageRow[];
}

/** Documents a service needs from the client, in position order. */
export async function getServiceDocs(db: Db, serviceId: string): Promise<ServiceDocRow[]> {
  const { data, error } = await db
    .from("service_docs")
    .select("*")
    .eq("service_id", serviceId)
    .order("position", { ascending: true });
  if (error) fail("getServiceDocs", error);
  return (data ?? []) as ServiceDocRow[];
}

/**
 * The order the dashboard should show, or null when the user has none.
 *
 * Orders that are finished are left out. Among the rest, a paid order wins
 * over a newer unpaid one, so a client who started a second application by
 * mistake still sees the order they are paying for; then the newest.
 */
export async function getLatestUserService(db: Db, userId: string): Promise<UserServiceRow | null> {
  const { data, error } = await db
    .from("user_services")
    .select("*")
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("paid_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail("getLatestUserService", error);
  return (data as UserServiceRow | null) ?? null;
}

/**
 * One order by id, only when it belongs to `userId`. The user filter is
 * applied here as well as by RLS so the admin client cannot hand one user's
 * order to another by mistake.
 */
export async function getUserService(db: Db, id: string, userId: string): Promise<UserServiceRow | null> {
  const { data, error } = await db
    .from("user_services")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail("getUserService", error);
  return (data as UserServiceRow | null) ?? null;
}

/** Every upload attempt on an order, oldest first. */
export async function getUserDocuments(db: Db, userServiceId: string): Promise<UserDocumentRow[]> {
  const { data, error } = await db
    .from("user_documents")
    .select("*")
    .eq("user_service_id", userServiceId)
    .order("created_at", { ascending: true });
  if (error) fail("getUserDocuments", error);
  return (data ?? []) as UserDocumentRow[];
}

/**
 * The service agreement prepared for an order, or null when there is none
 * yet (docs/agreement-contract.md section 4). One row per order at most. The
 * user client sees the row of its own orders only (RLS); the row is written
 * by src/lib/contracts/ensure.ts and by nothing else.
 */
export async function getOrderContract(db: Db, userServiceId: string): Promise<UserServiceContractRow | null> {
  const { data, error } = await db
    .from("user_service_contracts")
    .select("*")
    .eq("user_service_id", userServiceId)
    .maybeSingle();
  if (error) fail("getOrderContract", error);
  return (data as UserServiceContractRow | null) ?? null;
}

/** The stage history of an order, oldest first. */
export async function getUserServiceEvents(db: Db, userServiceId: string): Promise<UserServiceEventRow[]> {
  const { data, error } = await db
    .from("user_service_events")
    .select("*")
    .eq("user_service_id", userServiceId)
    .order("created_at", { ascending: true });
  if (error) fail("getUserServiceEvents", error);
  return (data ?? []) as UserServiceEventRow[];
}
