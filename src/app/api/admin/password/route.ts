import { createClient } from "@supabase/supabase-js";

import { requireAdmin } from "@/lib/supabase/admin-user";
import { createClient as createSessionClient } from "@/lib/supabase/server";

import { INVALID_BODY, audit, errorResponse, readJson, refuse } from "../_lib/http";

/**
 * POST /api/admin/password, body `{ currentPassword, newPassword }`. The
 * change on /admin/settings (docs/admin-contract.md section 7, amended
 * 2026-09-21: the current password is asked for).
 *
 * requireAdmin() first, so only an admin in a password session gets here.
 * Then the current password is checked the only way Supabase allows: a
 * sign in, made with a separate client (publishable key, nothing
 * persisted, no cookies), so the admin's own session is never touched by
 * the check. That extra session is signed out at once.
 *
 * The new password is then set with the admin's own session (the cookie
 * bound server client), not with the check's: Supabase ends every other
 * session of the account when a password changes and keeps only the one
 * that made the change (seen 2026-09-21: an update made by the check's
 * session signed the browser out). So this device stays signed in, as the
 * settings page says, and every other device needs the new password.
 *
 *   200  { ok: true }
 *   401  signed out (also when the session ends before the update)
 *   403  a client, or "Sign in with your password." for a code session
 *   400  body missing or not the two strings
 *   422  "Your current password is not right." or a line about the new one
 *   429  Supabase's rate limit on sign ins
 *
 * Neither password is ever logged or echoed back; the audit line names the
 * admin only.
 */

const MIN_LENGTH = 12;
/** Supabase Auth refuses passwords longer than 72 characters (bcrypt). */
const MAX_LENGTH = 72;

const WRONG_CURRENT = "Your current password is not right.";
const TOO_SHORT = `Use at least ${MIN_LENGTH} characters.`;
const TOO_LONG = `Use at most ${MAX_LENGTH} characters.`;
const SAME = "Choose a password different from the current one.";
const WEAK = "Choose a password that is harder to guess.";
const REJECTED = "That password was not accepted. Try a longer one.";
const RATE_LIMITED = "Too many attempts. Wait a few minutes and try again.";
const SIGN_IN = "Sign in to continue.";

type AuthErrorLike = { code?: string; status?: number; message: string };

function isRateLimited(error: AuthErrorLike): boolean {
  return error.status === 429 || error.code === "over_request_rate_limit";
}

/** A client that signs in once, keeps nothing and never refreshes. */
function probeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set. See .env.example.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();

    const body = await readJson(request);
    const current = body?.currentPassword;
    const next = body?.newPassword;
    if (typeof current !== "string" || typeof next !== "string" || !current) return refuse(400, INVALID_BODY);
    if (next.length < MIN_LENGTH) return refuse(422, TOO_SHORT);
    if (next.length > MAX_LENGTH) return refuse(422, TOO_LONG);
    if (next === current) return refuse(422, SAME);

    const probe = probeClient();
    const signIn = await probe.auth.signInWithPassword({ email: admin.email, password: current });
    if (signIn.error) {
      if (isRateLimited(signIn.error)) return refuse(429, RATE_LIMITED);
      const status = signIn.error.status;
      if (signIn.error.code === "invalid_credentials" || (status !== undefined && status >= 400 && status < 500)) {
        return refuse(422, WRONG_CURRENT);
      }
      throw new Error(`password check failed: ${signIn.error.code ?? status ?? "unknown"}`);
    }

    const checkedUserId = signIn.data.user?.id;
    // The check has done its job: end the session it opened.
    await probe.auth.signOut({ scope: "local" }).catch(() => undefined);
    if (checkedUserId !== admin.id) {
      // The admin's email signed in as someone else: never go on.
      throw new Error("password check signed in as another user");
    }

    const session = await createSessionClient();
    const updated = await session.auth.updateUser({ password: next });
    if (updated.error) {
      const error = updated.error;
      if (error.code === "weak_password") return refuse(422, WEAK);
      if (error.code === "same_password") return refuse(422, SAME);
      if (isRateLimited(error)) return refuse(429, RATE_LIMITED);
      // The session ended between the guard and the update.
      if (error.status === 401 || error.code === "session_not_found") return refuse(401, SIGN_IN);
      if (error.status !== undefined && error.status >= 400 && error.status < 500) return refuse(422, REJECTED);
      throw new Error(`password update failed: ${error.code ?? error.status ?? "unknown"}`);
    }

    audit(admin, "password.change", admin.id);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
