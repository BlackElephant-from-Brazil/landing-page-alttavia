import { getUserDeletionCounts } from "@/lib/db/admin-queries";
import type { UserRow } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/admin-user";
import { validateAccountPatch } from "@/lib/users/account-input";
import { deleteClientAccount, updateClientAccount } from "@/lib/users/accounts";

import { INVALID_BODY, audit, errorResponse, isUuid, readJson, refuse } from "../../_lib/http";

/**
 * One client account, as the admin users page acts on it. Contract
 * (docs/admin-contract.md) section 6, "Users".
 *
 * GET: the profile and what goes with it if it were deleted. The delete
 * dialog reads this so the admin sees the count before typing the email.
 * Answers `{ user, counts }`; 404 for an id nothing holds.
 *
 * PATCH, body `{ fullName?, phone?, email? }`: changes a client. An
 * administrator account is refused with 403, since only its own session may
 * change it (/admin/settings). A new email is set in Auth as well, because
 * that is where the sign in code goes. Answers `{ user }`; 409 an address
 * already in use; 422 names the first field that is wrong.
 *
 * DELETE, body `{ email }`: removes the client and everything they own, in
 * the order src/lib/users/accounts.ts documents, after the typed email has
 * matched the account. Refuses an administrator and the caller's own
 * account with 403. Answers `{ deleted: true, counts }`. One audit line
 * with the counts, which is the only record left of what went.
 *
 * The checks run in one order on every method: the id has to be a uuid, the
 * account has to exist, and only then is the body looked at. An id nothing
 * holds therefore answers 404 whatever the body says.
 */

const NOT_FOUND = "This user is not on record.";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();

    const { id } = await ctx.params;
    if (!isUuid(id)) return refuse(404, NOT_FOUND);

    const db = createAdminClient();
    const counts = await getUserDeletionCounts(db, id);
    if (!counts) return refuse(404, NOT_FOUND);

    const { data, error } = await db.from("users").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`users: ${error.message}`);
    const user = data as UserRow | null;
    if (!user) return refuse(404, NOT_FOUND);

    return Response.json({ user, counts });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();

    const { id } = await ctx.params;
    if (!isUuid(id)) return refuse(404, NOT_FOUND);

    const body = await readJson(request);
    if (!body) return refuse(400, INVALID_BODY);
    const result = validateAccountPatch(body);
    if (!result.ok) return refuse(422, result.error);

    const user = await updateClientAccount(createAdminClient(), id, result.value);
    audit(admin, "user.update", id, Object.keys(result.value).join(" "));

    return Response.json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();

    const { id } = await ctx.params;
    if (!isUuid(id)) return refuse(404, NOT_FOUND);

    // A body that is missing or malformed is not refused here: the account
    // checks come first, so a stale link answers 404 rather than 400. The
    // typed email is then checked inside deleteClientAccount.
    const body = await readJson(request);
    const confirmEmail = typeof body?.email === "string" ? body.email : null;

    const removed = await deleteClientAccount(createAdminClient(), id, { actorId: admin.id, confirmEmail });
    audit(
      admin,
      "user.delete",
      id,
      `${removed.email} orders ${removed.counts.orders} files ${removed.filesDeleted} agreements ${removed.counts.agreements}`,
    );

    return Response.json({ deleted: true, counts: removed.counts });
  } catch (error) {
    return errorResponse(error);
  }
}
