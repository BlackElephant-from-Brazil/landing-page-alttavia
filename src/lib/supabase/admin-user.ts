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
 * A second factor (2026-09-25): a code from an authenticator app (TOTP,
 * Supabase Auth MFA). Once it is verified the token says `aal: "aal2"`.
 * Two rules decide when that is asked for:
 *
 *   - Enrolled means required, always. An admin with a verified factor
 *     must be at aal2; a password alone is aal1 and reads as a client. The
 *     login form asks for the code right after the password, but the
 *     password step already writes the session cookies, so without this
 *     rule typing /admin in the address bar would skip the code. It cannot
 *     lock anyone out: an admin who never set a factor up is not asked.
 *     supabase/migrations/0015_admin_mfa.sql gives `is_admin()` the same
 *     rule, so RLS and the app agree.
 *   - ADMIN_REQUIRE_MFA=1 asks aal2 of every admin, enrolled or not. Soft
 *     first: while it is unset the firm can enrol at its own pace. Once it
 *     is set, an admin without a factor who signs in with the password is
 *     led through the set up on /admin/login before going on.
 *
 * An admin short of the second factor gets `role: "client"`,
 * `needsPassword: true` (the flag the admin layout already reads to send
 * someone to /admin/login) and `needsCode: true`; the login page then shows
 * "Sign in with your password and your code." `needsPassword` therefore
 * means "must sign in again at /admin/login", whatever is missing.
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
   * `public.users.role` is admin, the session was opened with a password
   * and the second factor rules above are met. Everything else, an admin
   * signed in with a code included, is "client".
   */
  role: UserRole;
  /**
   * `public.users.role` is admin, but this session cannot act as one: it
   * was not opened with a password, or the second factor is missing. The
   * admin pages send it to /admin/login.
   */
  needsPassword: boolean;
  /** A password session of an admin that still needs the code from the authenticator app (aal2). */
  needsCode: boolean;
};
export type AdminUser = SessionUser & { role: "admin" };

const SIGN_IN = "Sign in to continue.";
const NOT_ALLOWED = "Not allowed.";
/** The one line an admin reads when their session came from an emailed code. */
export const PASSWORD_REQUIRED = "Sign in with your password.";
/** The one line an admin reads when their password session still needs the authenticator code. */
export const SECOND_FACTOR_REQUIRED = "Sign in with your password and your code.";
const GENERIC = "Something went wrong on our side.";

/** The authentication method that unlocks the admin area. */
const PASSWORD_METHOD = "password";

/** The environment variable that asks every admin for the second factor. */
export const REQUIRE_MFA_ENV = "ADMIN_REQUIRE_MFA";

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

/**
 * True when the user has at least one verified factor, of any type: the
 * same test Supabase uses to answer `nextLevel: "aal2"` and the one
 * 0015_admin_mfa.sql makes on `auth.mfa_factors`. An unverified factor (a
 * set up left halfway) does not count.
 */
export function hasVerifiedFactor(factors: unknown): boolean {
  if (!Array.isArray(factors)) return false;
  return factors.some(
    (factor) =>
      typeof factor === "object" && factor !== null && (factor as { status?: unknown }).status === "verified",
  );
}

/** True only for the exact value "1", so a typo never turns enforcement on or off by surprise. */
export function mfaRequiredForAll(env: Record<string, string | undefined> = process.env): boolean {
  return env[REQUIRE_MFA_ENV] === "1";
}

export type AdminSessionFacts = {
  /** `public.users.role` is admin. */
  storedAdmin: boolean;
  /** The verified `amr` claim lists a password sign in. */
  password: boolean;
  /** The verified `aal` claim is "aal2". */
  aal2: boolean;
  /** The account has a verified factor. */
  enrolled: boolean;
  /** ADMIN_REQUIRE_MFA is "1". */
  requireForAll: boolean;
};

export type AdminAccess = Pick<SessionUserWithRole, "role" | "needsPassword" | "needsCode">;

/**
 * The decision, pure. See the file comment for the rules; in short: a
 * password always, the code when the account has a factor or when every
 * admin must have one.
 */
export function adminAccess(facts: AdminSessionFacts): AdminAccess {
  if (!facts.storedAdmin) return { role: "client", needsPassword: false, needsCode: false };
  if (!facts.password) return { role: "client", needsPassword: true, needsCode: false };
  const codeRequired = facts.enrolled || facts.requireForAll;
  if (codeRequired && !facts.aal2) return { role: "client", needsPassword: true, needsCode: true };
  return { role: "admin", needsPassword: false, needsCode: false };
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

type VerifiedSession = { password: boolean; aal2: boolean };

/**
 * How the session the client holds was opened, read from the verified
 * claims of the same session `getUser()` just checked (`sub` must match).
 * Fails closed: an error, a thrown exception or a claim for someone else
 * all answer no password and no second factor.
 */
async function verifiedSession(supabase: ServerClient, userId: string): Promise<VerifiedSession> {
  const none = { password: false, aal2: false };
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data) return none;
    if (data.claims.sub !== userId) return none;
    return { password: hasPasswordMethod(data.claims.amr), aal2: data.claims.aal === "aal2" };
  } catch (error) {
    console.error("getUserWithRole: could not verify the session claims:", error instanceof Error ? error.name : "unknown");
    return none;
  }
}

/**
 * The signed in user and their role, or null when signed out. A profile row
 * that is missing (an auth user the mirror trigger never saw) counts as a
 * client: nothing is granted by absence.
 *
 * One client for the three calls, so the token `getUser()` validates with
 * Supabase Auth (the check that also sees a signed out session) is the one
 * whose claims are read. The factors come with that same validated user.
 * An account without an email cannot exist here (see
 * src/lib/supabase/user.ts) and is treated as signed out.
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
  const session = storedAdmin ? await verifiedSession(supabase, user.id) : { password: false, aal2: false };
  const enrolled = storedAdmin && hasVerifiedFactor(user.factors);

  const access = adminAccess({
    storedAdmin,
    password: session.password,
    aal2: session.aal2,
    enrolled,
    requireForAll: mfaRequiredForAll(),
  });

  return { id: user.id, email: user.email, ...access };
}

/**
 * The signed in admin, or an AdminAuthError: 401 signed out, 403 a client,
 * 403 "Sign in with your password." for an admin whose session came from a
 * code, 403 "Sign in with your password and your code." for a password
 * session that still needs the authenticator code.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getUserWithRole();
  if (!user) throw new AdminAuthError(401);
  if (user.needsCode) throw new AdminAuthError(403, SECOND_FACTOR_REQUIRED);
  if (user.needsPassword) throw new AdminAuthError(403, PASSWORD_REQUIRED);
  if (user.role !== "admin") throw new AdminAuthError(403);
  return { id: user.id, email: user.email, role: "admin" };
}

/**
 * requireAdmin() for a page: an AdminAuthError becomes a redirect to
 * /admin/login, which shows the matching line to an admin who is short of
 * the password or of the code.
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
