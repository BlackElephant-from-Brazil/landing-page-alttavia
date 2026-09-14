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
 * index on another of their orders (null for an admin), so the form opens
 * filled in.
 *
 * PUT, owner only: validates the body (see validateApplicantInput for the
 * keys it accepts), upserts on (order, index) and answers 200 `{ applicant }`
 * with the row as stored, or 422 `{ error }` with the first validation
 * message. An admin gets 403: for now they correct through the client.
 *
 * `index` is 0 or 1 and must be below the order's `applicants`. Reads and
 * the write go through the admin client after the session and the owner
 * have been checked; the browser names nothing that is trusted.
 * `ctx.params` is a Promise in this Next.js.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SIGN_IN = "Sign in to continue.";
const NOT_YOURS = "This order is not yours.";
const ADMIN_CANNOT_WRITE = "Ask the client to enter their details.";
const ORDER_NOT_FOUND = "Order not found.";
const NO_APPLICANT = "There is no applicant at that position.";
const NO_DETAILS = "No details yet.";
const INVALID_BODY = "Check the details and try again.";
const GENERIC = "Something did not work. Try again.";

type Params = { params: Promise<{ id: string; index: string }> };

function refuse(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

function parseIndex(raw: string): 0 | 1 | null {
  if (raw === "0") return 0;
  if (raw === "1") return 1;
  return null;
}

/** Who may touch the order: its owner, or an admin reading it. */
function access(orderUserId: string, user: { id: string; role: UserRole }): "owner" | "admin" | "none" {
  if (orderUserId === user.id) return "owner";
  return user.role === "admin" ? "admin" : "none";
}

export async function GET(_request: Request, ctx: Params) {
  try {
    const user = await getUserWithRole();
    if (!user) return refuse(401, SIGN_IN);

    const { id, index: rawIndex } = await ctx.params;
    if (!UUID.test(id)) return refuse(404, ORDER_NOT_FOUND);
    const index = parseIndex(rawIndex);
    if (index === null) return refuse(404, NO_APPLICANT);

    const admin = createAdminClient();
    const order = await findOrder(admin, id);
    if (!order) return refuse(404, ORDER_NOT_FOUND);

    const who = access(order.user_id, user);
    if (who === "none") return refuse(403, NOT_YOURS);
    if (index >= order.applicants) return refuse(404, NO_APPLICANT);

    const applicant = await findApplicant(admin, order.id, index);
    if (applicant) return Response.json({ applicant });

    const prefill = who === "owner" ? await findPrefill(admin, user.id, index) : null;
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
    if (!UUID.test(id)) return refuse(404, ORDER_NOT_FOUND);
    const index = parseIndex(rawIndex);
    if (index === null) return refuse(404, NO_APPLICANT);

    const admin = createAdminClient();
    const order = await findOrder(admin, id);
    if (!order) return refuse(404, ORDER_NOT_FOUND);

    const who = access(order.user_id, user);
    if (who === "admin") return refuse(403, ADMIN_CANNOT_WRITE);
    if (who === "none") return refuse(403, NOT_YOURS);
    if (index >= order.applicants) return refuse(404, NO_APPLICANT);

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
