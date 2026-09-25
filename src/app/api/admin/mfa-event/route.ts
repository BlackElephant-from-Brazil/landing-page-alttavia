import { requireAdmin } from "@/lib/supabase/admin-user";
import { createClient } from "@/lib/supabase/server";

import { INVALID_BODY, audit, errorResponse, isUuid, readJson, refuse } from "../_lib/http";

/**
 * POST /api/admin/mfa-event, body `{ action: "enrol" | "unenrol", factorId }`.
 * The audit line of a change to the admin's second factor (2026-09-25).
 *
 * The second factor card (src/components/admin/settings/mfa-enrol.tsx) turns
 * the authenticator code on and off in the browser, against Supabase Auth,
 * so the change itself never passes through /api/admin/* and left no
 * `[admin]` line in the server log, as every other admin write does. The
 * card calls this route once the change is done, and the route writes that
 * line with audit(): `mfa.enrol` or `mfa.unenrol`, the admin and the factor.
 *
 * The line is only written when it is true. requireAdmin() first; then the
 * account's factors are read from Supabase Auth with the admin's own
 * session, and an enrolment is recorded only when the factor is on the
 * account and verified, a removal only when it is gone. So the log cannot be
 * made to say something that did not happen. Supabase Auth keeps its own
 * record of both changes as well (auth.audit_log_entries).
 *
 *   200  { ok: true }
 *   400  body missing, an unknown action or a factor id that is not a uuid
 *   401  signed out, or the session ended in between
 *   403  a client, or an admin session short of the password or the code
 *   409  the account does not show the change: nothing is written
 *
 * Writes nothing but the log line.
 */

const ACTIONS = { enrol: "mfa.enrol", unenrol: "mfa.unenrol" } as const;

type Action = keyof typeof ACTIONS;

const NOT_ON_ACCOUNT = "This change is not on your account.";
const SIGN_IN = "Sign in to continue.";

function isAction(value: unknown): value is Action {
  return value === "enrol" || value === "unenrol";
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();

    const body = await readJson(request);
    const action = body?.action;
    const factorId = body?.factorId;
    if (!isAction(action) || !isUuid(factorId)) return refuse(400, INVALID_BODY);

    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user || user.id !== admin.id) return refuse(401, SIGN_IN);

    const factor = (user.factors ?? []).find((entry) => entry.id === factorId);
    const shown = action === "enrol" ? factor?.status === "verified" : !factor;
    if (!shown) return refuse(409, NOT_ON_ACCOUNT);

    audit(admin, ACTIONS[action], factorId);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
