import "server-only";

import type { UserRole } from "@/lib/db/types";

import { createClient } from "./server";
import { getUser, type SessionUser } from "./user";

/**
 * The signed in user with their role, for the admin area. Contract
 * (docs/admin-contract.md) section 4.
 *
 * The role is `public.users.role`, read through the user client: the
 * `users_select_own` policy lets anyone read their own row, and the column
 * cannot be edited from the browser (the update grant covers full_name and
 * phone only). No JWT claim is involved, so a role change is seen on the
 * next request.
 *
 *   const user = await getUserWithRole();   // pages: decide where to send them
 *   const admin = await requireAdmin();      // routes: throws 401 or 403
 *
 * Route handlers wrap the call and hand the error to adminErrorResponse():
 *
 *   try { await requireAdmin(); } catch (e) { return adminErrorResponse(e); }
 */

export type SessionUserWithRole = SessionUser & { role: UserRole };
export type AdminUser = SessionUser & { role: "admin" };

const SIGN_IN = "Sign in to continue.";
const NOT_ALLOWED = "Not allowed.";
const GENERIC = "Something went wrong on our side.";

export class AdminAuthError extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403) {
    super(status === 401 ? SIGN_IN : NOT_ALLOWED);
    this.name = "AdminAuthError";
    this.status = status;
  }
}

/**
 * The signed in user and their role, or null when signed out. A profile row
 * that is missing (an auth user the mirror trigger never saw) counts as a
 * client: nothing is granted by absence.
 */
export async function getUserWithRole(): Promise<SessionUserWithRole | null> {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (error) throw new Error(`getUserWithRole: ${error.message}`);

  const role: UserRole = (data as { role?: unknown } | null)?.role === "admin" ? "admin" : "client";
  return { ...user, role };
}

/** The signed in admin, or an AdminAuthError: 401 signed out, 403 a client. */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getUserWithRole();
  if (!user) throw new AdminAuthError(401);
  if (user.role !== "admin") throw new AdminAuthError(403);
  return { ...user, role: "admin" };
}

/**
 * The JSON response for an error thrown around requireAdmin(): 401 or 403
 * with the one line copy, and 500 with a generic line (logged) for anything
 * else, so a route never leaks a database message.
 */
export function adminErrorResponse(error: unknown): Response {
  if (error instanceof AdminAuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("admin route failed:", error);
  return Response.json({ error: GENERIC }, { status: 500 });
}
