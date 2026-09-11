import { getServiceBySlug } from "@/lib/db/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/user";

/**
 * POST /api/orders, body `{ serviceSlug, quantity?: 1 | 2 }`. Admin contract
 * section 6, "Client routes added".
 *
 * An order placed from the gallery on /en/dashboard/orders, without the
 * questions. The browser names a service and, for NIF only, how many; the
 * price, the total, the applicants and the stage are computed here from the
 * service row, never taken from the request. `answers_snapshot` is `{}`,
 * which is how the order view knows to hide the answers section.
 *
 * Writes with the admin client after the session check, like
 * /api/apply/submit: the user_services row at awaiting_payment and its first
 * user_service_events row. Answers `{ userServiceId }`; the Buy button then
 * posts it to /api/checkout.
 */

const SAVE_ERROR = "Could not place the order. Please try again.";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 64;

function fail(status: number, message: string) {
  return Response.json({ error: message }, { status });
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
  const input = body && typeof body === "object" ? (body as { serviceSlug?: unknown; quantity?: unknown }) : {};

  const slug = typeof input.serviceSlug === "string" ? input.serviceSlug.trim().toLowerCase() : "";
  if (!slug || slug.length > MAX_SLUG_LENGTH || !SLUG.test(slug)) {
    return fail(400, "Choose a service.");
  }

  let quantity: 1 | 2 = 1;
  if (input.quantity !== undefined) {
    if (input.quantity !== 1 && input.quantity !== 2) return fail(422, "Quantity must be 1 or 2.");
    quantity = input.quantity;
  }

  try {
    const admin = createAdminClient();

    const service = await getServiceBySlug(admin, slug);
    if (!service || !service.active) return fail(404, "That service is not available.");
    if (quantity === 2 && !service.supports_quantity) {
      return fail(422, "This service is sold one at a time.");
    }

    // The couple package is one unit for two people on a joint account; NIF
    // only x2 is two units for two people; everything else is one unit for
    // one person. Same rule as applicantsFor() in src/lib/apply/recommend.ts.
    const joint = service.slug === "couple";
    const applicants = joint ? 2 : quantity;
    const totalCents = service.price_cents * quantity;
    const currency = service.currency || "eur";

    const { data: created, error: orderError } = await admin
      .from("user_services")
      .insert({
        user_id: user.id,
        service_id: service.id,
        submission_id: null,
        answers_snapshot: {},
        quantity,
        joint,
        applicants,
        total_cents: totalCents,
        currency,
        stage_key: "awaiting_payment",
      })
      .select("id")
      .single();
    if (orderError || !created) {
      throw new Error(`user_services: ${orderError?.message ?? "no row returned"}`);
    }
    const userServiceId = (created as { id: string }).id;

    const { error: eventError } = await admin.from("user_service_events").insert({
      user_service_id: userServiceId,
      from_stage: null,
      to_stage: "awaiting_payment",
      note: "Ordered from the gallery",
      actor_id: user.id,
    });
    if (eventError) {
      // The order exists and can be paid; the audit row is worth a log line.
      console.error(`POST /api/orders: event insert failed for ${userServiceId}: ${eventError.message}`);
    }

    return Response.json({ userServiceId });
  } catch (err) {
    console.error(`POST /api/orders failed for user ${user.id} (${slug} x${quantity}):`, err);
    return fail(500, SAVE_ERROR);
  }
}
