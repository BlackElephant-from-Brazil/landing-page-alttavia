import { NextResponse } from "next/server";

import { ensureContract, parseSigningPlace } from "@/lib/contracts/ensure";
import { getOrderContract } from "@/lib/db/queries";
import type { UserRole } from "@/lib/db/types";
import { findOrder } from "@/lib/orders/applicants";
import { getObjectBytes } from "@/lib/r2/client";
import { contentDisposition } from "@/lib/r2/keys";
import { siteOrigin } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserWithRole } from "@/lib/supabase/admin-user";

/**
 * /api/orders/[id]/contract. Design (docs/agreement-contract.md) section 5.
 *
 * POST, owner only: prepares the order's service agreement if it is not
 * there yet and answers 200 `{ status: "ready" }`. The body is optional JSON,
 * `{ signingPlace?: string }`: the city and country the client is in, printed
 * in Annex I; trimmed, control characters stripped, at most 120 characters
 * (422 with a line the form can show). A body over 4 KB is refused with 413.
 * Calling it again is safe: the agreement is generated once, and an email
 * that did not go out the first time is tried again (ensureContract).
 *
 *   404  the service has no contract, so there is nothing to prepare
 *   409  `{ error: "Payment first." }` on an unpaid order
 *   409  `{ error: "details_missing" }` when applicant 0 has no details yet,
 *        the code the form reacts to
 *   403  an admin: the firm regenerates through /api/admin/orders/[id]/contract
 *
 * GET, owner or admin: 200 with the stored PDF itself, read from the bucket
 * and streamed from here. It used to answer a 302 to a presigned URL good
 * for two minutes: the tab then sat on a storage address, and a refresh
 * after the two minutes showed the bucket's XML error instead of the
 * agreement. `Content-Disposition` is `inline` by default, so the browser
 * tab shows it; `?download=1` answers `attachment`, so it is saved instead.
 * The file name travels as `filename` and `filename*`; the answer is never
 * cached (`private, no-store`) and never sniffed. 404
 * `{ error: "No agreement yet." }` when none was prepared. A visitor without
 * a session is sent to login rather than given a JSON 401, because this URL
 * is opened by a click, with `next` set to the order, so they land on it
 * after signing in. The redirect is built on siteOrigin
 * (src/lib/site-url.ts), never on 0.0.0.0.
 *
 * An order that does not exist, or is not the caller's, answers 403 "This
 * order is not yours." the way the other order routes do, so a client cannot
 * tell the two apart; only an admin gets 404 for a missing order.
 *
 * Reads and writes go through the admin client after the session and the
 * owner have been checked. Nothing here is called from the payment path.
 * `ctx.params` is a Promise in this Next.js.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOGIN = "/en/login";
const DASHBOARD = "/en/dashboard";
const PDF = "application/pdf";

/**
 * Where a visitor without a session is sent: login, then the order itself,
 * so they land on the agreement's card after signing in. The id is echoed
 * into the URL only when it is a UUID (hex and hyphens, nothing to encode);
 * anything else goes to the dashboard.
 */
function loginPath(id: string): string {
  return `${LOGIN}?next=${UUID.test(id) ? `${DASHBOARD}/orders/${id}` : DASHBOARD}`;
}

/** `{ signingPlace }` is a couple of hundred bytes at most; anything bigger is not this form. */
const MAX_BODY_BYTES = 4096;

const SIGN_IN = "Sign in to continue.";
const NOT_YOURS = "This order is not yours.";
const ORDER_NOT_FOUND = "Order not found.";
const ADMIN_CANNOT_PREPARE = "Use the order's admin page to prepare the agreement.";
const NO_CONTRACT = "This order has no service agreement.";
const NO_AGREEMENT_YET = "No agreement yet.";
const PAYMENT_FIRST = "Payment first.";
const DETAILS_MISSING = "details_missing";
const INVALID_BODY = "Check the details and try again.";
const TOO_MUCH_DATA = "Too much data.";
const GENERIC = "Something did not work. Try again.";

type Params = { params: Promise<{ id: string }> };

type Caller = { id: string; role: UserRole };

function refuse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** No such order: an admin learns that, anyone else hears what a stranger's order answers. */
function missingOrder(user: Caller) {
  return user.role === "admin" ? refuse(404, ORDER_NOT_FOUND) : refuse(403, NOT_YOURS);
}

/** Who may touch the order: its owner, or an admin reading it. */
function access(orderUserId: string, user: Caller): "owner" | "admin" | "none" {
  if (orderUserId === user.id) return "owner";
  return user.role === "admin" ? "admin" : "none";
}

function declaredTooLarge(request: Request): boolean {
  const length = Number(request.headers.get("content-length"));
  return Number.isFinite(length) && length > MAX_BODY_BYTES;
}

type Body = { ok: true; signingPlace: unknown } | { ok: false; status: 400 | 413; message: string };

/**
 * The optional JSON body. Nothing at all is fine: the place is optional and
 * so is the body. The size is checked twice, as declared and as read, because
 * a chunked request declares nothing.
 */
async function readBody(request: Request): Promise<Body> {
  if (declaredTooLarge(request)) return { ok: false, status: 413, message: TOO_MUCH_DATA };

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, status: 400, message: INVALID_BODY };
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return { ok: false, status: 413, message: TOO_MUCH_DATA };
  }
  if (!raw.trim()) return { ok: true, signingPlace: undefined };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, status: 400, message: INVALID_BODY };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, status: 400, message: INVALID_BODY };
  }
  return { ok: true, signingPlace: (parsed as Record<string, unknown>).signingPlace };
}

/** The origin links inside the email are built on: the site URL when set, else where the request came from. */
function requestOrigin(request: Request): string {
  return process.env.NEXT_PUBLIC_SITE_URL || request.headers.get("origin") || new URL(request.url).origin;
}

export async function POST(request: Request, ctx: Params) {
  try {
    const user = await getUserWithRole();
    if (!user) return refuse(401, SIGN_IN);

    const { id } = await ctx.params;
    if (!UUID.test(id)) return missingOrder(user);

    const admin = createAdminClient();
    const order = await findOrder(admin, id);
    if (!order) return missingOrder(user);

    const who = access(order.user_id, user);
    if (who === "admin") return refuse(403, ADMIN_CANNOT_PREPARE);
    if (who === "none") return refuse(403, NOT_YOURS);

    const body = await readBody(request);
    if (!body.ok) return refuse(body.status, body.message);
    const place = parseSigningPlace(body.signingPlace);
    if (!place.ok) return refuse(place.status, place.message);

    const result = await ensureContract(admin, order.id, {
      signingPlace: place.value,
      origin: requestOrigin(request),
    });

    if (result.status === "ready") return NextResponse.json({ status: "ready" });
    if (result.status === "needs_details") return refuse(409, DETAILS_MISSING);
    if (result.reason === "unpaid") return refuse(409, PAYMENT_FIRST);
    if (result.reason === "no_template") return refuse(404, NO_CONTRACT);
    // The order was there a moment ago and is gone: answer what a missing order answers.
    return missingOrder(user);
  } catch (error) {
    console.error("[orders/[id]/contract] POST", error);
    return refuse(500, GENERIC);
  }
}

export async function GET(request: Request, ctx: Params) {
  try {
    const { id } = await ctx.params;
    const user = await getUserWithRole();
    if (!user) return NextResponse.redirect(new URL(loginPath(id), siteOrigin(request)), 302);

    if (!UUID.test(id)) return missingOrder(user);

    const admin = createAdminClient();
    const order = await findOrder(admin, id);
    if (!order) return missingOrder(user);

    const who = access(order.user_id, user);
    if (who === "none") return refuse(403, NOT_YOURS);

    const contract = await getOrderContract(admin, order.id);
    if (!contract) return refuse(404, NO_AGREEMENT_YET);

    const pdf = await getObjectBytes(contract.storage_key);
    // A row without its file is a fault of ours, not a state the client can be in: log it and answer the 500.
    if (!pdf) throw new Error(`${contract.storage_key} is on record and not in the bucket`);
    if (who === "admin") console.info(`[admin] ${user.id} contract.download ${order.id} v${contract.version}`);

    const download = new URL(request.url).searchParams.get("download") === "1";
    // A copy in a buffer of its own: the SDK may hand back a view over a larger one.
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": PDF,
        "Content-Length": String(pdf.byteLength),
        "Content-Disposition": contentDisposition(download ? "attachment" : "inline", contract.file_name),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[orders/[id]/contract] GET", error);
    return refuse(500, GENERIC);
  }
}
