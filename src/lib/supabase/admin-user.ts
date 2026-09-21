import "server-only";

import { redirect } from "next/navigation";

import type { UserRole } from "@/lib/db/types";

import { createClient } from "./server";
import type { SessionUser } from "./user";

/**
 * The signed in user with their role, for the admin area. Contract
 * (docs/admin-contract.md) section 4.
 *
 * The role is `public.users.role`, read through the user client: the
 * `users_select_own` policy lets anyone read their own row, and the column
 * cannot be edited from the browser (the update grant covers full_name and
 * phone only). No JWT claim is involved in the role, so a role change is
 * seen on the next request.
 *
 * Admin powers also need a session opened with a password (2026-09-21).
 * The client area signs people in with a code sent by email, and an admin
 * account is an email address like any other: anyone who can read the
 * firm's inbox could otherwise open /admin with a code from /en/login. So
 * the session's `amr` claim (how it was authenticated, verified with
 * `getClaims()`) must name `password`. An admin whose session came from a
 * code, a recovery code or anything else gets `role: "client"` and
 * `needsPassword: true`: every caller that asks "is this an admin?" hears
 * no, and the admin pages send them to /admin/login, which asks for the
 * password with one line. The claim survives a token refresh (Supabase
 * keeps the session's methods), so a password session stays one.
 *
 *   const user = await getUserWithRole();   // layouts: decide where to send them
 *   const admin = await requireAdmin();      // routes: throws 401 or 403
 *   await requireAdminPage();                // admin pages: redirects to the login instead
 *
 * Route handlers wrap the call and hand the error to adminErrorResponse():
 *
 *   try { await requireAdmin(); } catch (e) { return adminErrorResponse(e); }
 *
 * requireAdminPage() is the belt and braces guard every admin page and the
 * order modal call on their first line, on top of the layout's check: a
 * page rendered outside the layout (or a layout edit that drops the check)
 * still never renders for a client or a visitor.
 */

const ADMIN_LOGIN_PATH = "/admin/login";

export type SessionUserWithRole = SessionUser & {
  /**
   * The role this session may act with: "admin" only when
   * `public.users.role` is admin and the session was opened with a
   * password. Everything else, an admin signed in with a code included, is
   * "client".
   */
  role: UserRole;
  /** `public.users.role` is admin, but this session was not opened with a password. */
  needsPassword: boolean;
};
export type AdminUser = SessionUser & { role: "admin" };

const SIGN_IN = "Sign in to continue.";
const NOT_ALLOWED = "Not allowed.";
/** The one line an admin reads when their session came from an emailed code. */
export const PASSWORD_REQUIRED = "Sign in with your password.";
const GENERIC = "Something went wrong on our side.";

/** The authentication method that unlocks the admin area. */
const PASSWORD_METHOD = "password";

export class AdminAuthError extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403, message?: string) {
    super(message ?? (status === 401 ? SIGN_IN : NOT_ALLOWED));
    this.name = "AdminAuthError";
    this.status = status;
  }
}

/**
 * True when a JWT `amr` claim lists a password sign in. Supabase writes
 * `amr` as `[{ method, timestamp }]` (a second factor adds its own entry
 * next to the first one); anything that is not that shape counts as no
 * password, so a malformed or missing claim never opens the door.
 */
export function hasPasswordMethod(amr: unknown): boolean {
  if (!Array.isArray(amr)) return false;
  return amr.some(
    (entry) =>
      typeof entry === "object" && entry !== null && (entry as { method?: unknown }).method === PASSWORD_METHOD,
  );
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Whether the session the client holds was opened with a password, read
 * from the verified claims of the same session `getUser()` just checked
 * (`sub` must match). Fails closed: an error, a thrown exception or a
 * claim for someone else all answer false.
 */
async function signedInWithPassword(supabase: ServerClient, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data) return false;
    if (data.claims.sub !== userId) return false;
    return hasPasswordMethod(data.claims.amr);
  } catch (error) {
    console.error("getUserWithRole: could not verify the session claims:", error instanceof Error ? error.name : "unknown");
    return false;
  }
}

/**
 * The signed in user and their role, or null when signed out. A profile row
 * that is missing (an auth user the mirror trigger never saw) counts as a
 * client: nothing is granted by absence.
 *
 * One client for the three calls, so the token `getUser()` validates with
 * Supabase Auth (the check that also sees a signed out session) is the one
 * whose claims are read. An account without an email cannot exist here
 * (see src/lib/supabase/user.ts) and is treated as signed out.
 */
export async function getUserWithRole(): Promise<SessionUserWithRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return null;

  const { data, error } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (error) throw new Error(`getUserWithRole: ${error.message}`);

  const storedAdmin = (data as { role?: unknown } | null)?.role === "admin";
  const password = storedAdmin ? await signedInWithPassword(supabase, user.id) : false;

  return {
    id: user.id,
    email: user.email,
    role: storedAdmin && password ? "admin" : "client",
    needsPassword: storedAdmin && !password,
  };
}

/**
 * The signed in admin, or an AdminAuthError: 401 signed out, 403 a client,
 * 403 "Sign in with your password." for an admin whose session came from a
 * code.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getUserWithRole();
  if (!user) throw new AdminAuthError(401);
  if (user.needsPassword) throw new AdminAuthError(403, PASSWORD_REQUIRED);
  if (user.role !== "admin") throw new AdminAuthError(403);
  return { id: user.id, email: user.email, role: "admin" };
}

/**
 * requireAdmin() for a page: an AdminAuthError becomes a redirect to
 * /admin/login, which shows "Sign in with your password." to an admin
 * signed in with a code.
 */
export async function requireAdminPage(): Promise<AdminUser> {
  let admin: AdminUser;
  try {
    admin = await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) redirect(ADMIN_LOGIN_PATH);
    throw error;
  }
  return admin;
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
