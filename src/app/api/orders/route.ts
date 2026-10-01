import { applyCopy } from "@/content/apply";
import { loadCountryGate } from "@/lib/orders/country-gate";
import { CLIENT_ORDER_NOTE, CreateOrderError, createOrder } from "@/lib/orders/create";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/user";

/**
 * POST /api/orders, body `{ serviceSlug }`. Admin contract section 6,
 * "Client routes added"; documents contract section 1: every service sells
 * one unit per purchase, so there is no quantity to send. A `quantity` key,
 * if an older client still sends one, is ignored. A second NIF is a second
 * purchase.
 *
 * An order placed from the purchase drawer on /en/dashboard/services or the
 * dashboard home, without the questions. The browser names a service; the
 * price, the total, the applicants and the stage are computed from the
 * service row by src/lib/orders/create.ts, never taken from the request.
 * `answers_snapshot` is `{}`, which is how the order view knows to hide the
 * answers section.
 *
 * The same module serves POST /api/admin/users/[id]/orders, where an admin
 * places the order for a client; only the event note and the actor differ.
 *
 * The owner's country block list (src/lib/orders/country-gate.ts) is
 * checked first, against the account's own applications, because nothing
 * here asks a country: 422 `blocked` when one names a blocked address or
 * passport, 422 `apply_first` when the account never sent the form (an
 * account opened at /en/login), which the drawer turns into a link to
 * /en/apply. Nothing is written for either. The admin route does not ask.
 *
 * Writes with the admin client after the session check, like
 * /api/apply/submit. Answers `{ userServiceId }`; the Buy button then posts
 * it to /api/checkout.
 */

const SAVE_ERROR = "Could not place the order. Please try again.";

function fail(status: number, message: string, code?: string) {
  return Response.json(code ? { error: message, code } : { error: message }, { status });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return fail(401, "Sign in to continue.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Invalid request.");
  }
  const input = body && typeof body === "object" ? (body as { serviceSlug?: unknown }) : {};
  const slug = typeof input.serviceSlug === "string" ? input.serviceSlug : "";

  try {
    const admin = createAdminClient();
    const gate = await loadCountryGate(admin, user.id);
    if (gate === "blocked") return fail(422, applyCopy.blocked.server, "blocked");
    if (gate === "apply_first") return fail(422, applyCopy.blocked.applyFirst, "apply_first");

    const { order } = await createOrder(admin, {
      userId: user.id,
      serviceSlug: slug,
      actorId: user.id,
      note: CLIENT_ORDER_NOTE,
    });
    return Response.json({ userServiceId: order.id });
  } catch (err) {
    if (err instanceof CreateOrderError) return fail(err.status, err.message);
    console.error(`POST /api/orders failed for user ${user.id} (${slug}):`, err);
    return fail(500, SAVE_ERROR);
  }
}
