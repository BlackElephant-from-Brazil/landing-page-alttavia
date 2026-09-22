import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/admin-user";
import { validateNewAccount } from "@/lib/users/account-input";
import { createClientAccount } from "@/lib/users/accounts";

import { INVALID_BODY, audit, errorResponse, readJson, refuse } from "../_lib/http";

/**
 * POST /api/admin/users, body `{ email, fullName, phone? }`: a client
 * account the firm makes for someone who did not sign up themselves.
 * Contract (docs/admin-contract.md) section 6, "Users".
 *
 * The account is created confirmed, with no password: the client signs in
 * from /en/login with a code sent to this address, like every other client.
 * Nothing is emailed from here, so the firm decides when to tell them.
 *
 * 422 names the first field that is wrong, 409 an address already in use
 * (AccountError carries its own status and line, which errorResponse passes
 * through). Answers 201 `{ userId }`. One audit line.
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();

    const body = await readJson(request);
    if (!body) return refuse(400, INVALID_BODY);
    const result = validateNewAccount(body);
    if (!result.ok) return refuse(422, result.error);

    const { userId } = await createClientAccount(createAdminClient(), result.value);
    audit(admin, "user.create", userId, result.value.email);

    return Response.json({ userId }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
