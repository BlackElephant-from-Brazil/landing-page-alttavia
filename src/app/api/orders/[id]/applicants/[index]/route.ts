import type { UserRole } from "@/lib/db/types";
import {
  findApplicant,
  findOrder,
  findPrefill,
  upsertApplicant,
  validateApplicantInput,
} from "@/lib/orders/applicants";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserWithRole } from "@/lib/supabase/admin-user";

/**
 * /api/orders/[id]/applicants/[index]. Contract (docs/documents-contract.md)
 * section 3, "Server".
 *
 * GET, owner or admin: 200 `{ applicant }` with the details entered for that
 * applicant of that order; 404 `{ error: "No details yet.", prefill }` when
 * there are none, where `prefill` is the owner's newest row for the same
 * index on another of their orders for a different service (null for an
 * admin), so the form opens filled in. Orders of the same service never
 * prefill: a second NIF on one account is for another person.
 *
 * PUT, owner only: validates the body (see validateApplicantInput for the
 * keys it accepts), upserts on (order, index) and answers 200 `{ applicant }`
 * with the row as stored, or 422 `{ error }` with the first validation
 * message. An admin gets 403: for now they correct through the client. A
 * body over 16 KB is refused with 413 before it is read.
 *
 * An order that does not exist, or is not the caller's, answers 403 "This
 * order is not yours." the way the documents routes do, so a client cannot
 * tell the two apart; only an admin gets 404 for a missing order.
 *
 * `index` is 0 or 1 and must be below the order's `applicants`. Reads and
 * the write go through the admin client after the session and the owner
 * have been checked; the browser names nothing that is trusted.
 * `ctx.params` is a Promise in this Next.js.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The nine fields are a few hundred bytes; anything bigger is not a form. */
const MAX_BODY_BYTES = 16384;

const SIGN_IN = "Sign in to continue.";
const NOT_YOURS = "This order is not yours.";
const ADMIN_CANNOT_WRITE = "Ask the client to enter their details.";
const ORDER_NOT_FOUND = "Order not found.";
const NO_APPLICANT = "There is no applicant at that position.";
const NO_DETAILS = "No details yet.";
const INVALID_BODY = "Check the details and try again.";
const TOO_MUCH_DATA = "Too much data.";
const GENERIC = "Something did not work. Try again.";

type Params = { params: Promise<{ id: string; index: string }> };

type Caller = { id: string; role: UserRole };

function refuse(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

function parseIndex(raw: string): 0 | 1 | null {
  if (raw === "0") return 0;
  if (raw === "1") return 1;
  return null;
}

/** Who may touch the order: its owner, or an admin reading it. */
function access(orderUserId: string, user: Caller): "owner" | "admin" | "none" {
  if (orderUserId === user.id) return "owner";
  return user.role === "admin" ? "admin" : "none";
}

/** No such order: an admin learns that, anyone else hears what a stranger's order answers. */
function missingOrder(user: Caller) {
  return user.role === "admin" ? refuse(404, ORDER_NOT_FOUND) : refuse(403, NOT_YOURS);
}

function tooLarge(request: Request): boolean {
  const length = Number(request.headers.get("content-length"));
  return Number.isFinite(length) && length > MAX_BODY_BYTES;
}

export async function GET(_request: Request, ctx: Params) {
  try {
    const user = await getUserWithRole();
    if (!user) return refuse(401, SIGN_IN);

    const { id, index: rawIndex } = await ctx.params;
    if (!UUID.test(id)) return missingOrder(user);
    const index = parseIndex(rawIndex);
    if (index === null) return refuse(404, NO_APPLICANT);

    const admin = createAdminClient();
    const order = await findOrder(admin, id);
    if (!order) return missingOrder(user);

    const who = access(order.user_id, user);
    if (who === "none") return refuse(403, NOT_YOURS);
    if (index >= order.applicants) return refuse(404, NO_APPLICANT);

    const applicant = await findApplicant(admin, order.id, index);
    if (applicant) return Response.json({ applicant });

    const prefill = who === "owner" ? await findPrefill(admin, user.id, index, order.service_id) : null;
    return Response.json({ error: NO_DETAILS, prefill }, { status: 404 });
  } catch (error) {
    console.error("[orders/[id]/applicants/[index]] GET", error);
    return refuse(500, GENERIC);
  }
}

export async function PUT(request: Request, ctx: Params) {
  try {
    const user = await getUserWithRole();
    if (!user) return refuse(401, SIGN_IN);

    const { id, index: rawIndex } = await ctx.params;
    if (!UUID.test(id)) return missingOrder(user);
    const index = parseIndex(rawIndex);
    if (index === null) return refuse(404, NO_APPLICANT);

    const admin = createAdminClient();
    const order = await findOrder(admin, id);
    if (!order) return missingOrder(user);

    const who = access(order.user_id, user);
    if (who === "admin") return refuse(403, ADMIN_CANNOT_WRITE);
    if (who === "none") return refuse(403, NOT_YOURS);
    if (index >= order.applicants) return refuse(404, NO_APPLICANT);

    if (tooLarge(request)) return refuse(413, TOO_MUCH_DATA);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return refuse(400, INVALID_BODY);
    }

    const checked = validateApplicantInput(body);
    if (!checked.ok) return refuse(checked.status, checked.message);

    const applicant = await upsertApplicant(admin, order.id, index, checked.value);
    return Response.json({ applicant });
  } catch (error) {
    console.error("[orders/[id]/applicants/[index]] PUT", error);
    return refuse(500, GENERIC);
  }
}
