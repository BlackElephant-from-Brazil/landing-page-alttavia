import { TERMS_REQUIRED, TERMS_VERSION } from "@/content/terms-version";
import { CheckoutError, createCheckoutForOrder } from "@/lib/stripe/checkout";
import { getUser } from "@/lib/supabase/user";

/**
 * POST /api/checkout, body `{ userServiceId, acceptTerms: true }`. Contract
 * section 8.
 *
 * Answers `{ url }` for the Pay button to navigate to, or `{ error }` with a
 * status the button can show as one line. Stripe's own error text never
 * reaches the browser: it names price ids and modes, which are ours to read
 * in the server log.
 *
 * `acceptTerms` is the client's acceptance of the service terms and the
 * service agreement, given by clicking Pay with the line of
 * src/content/terms-version.ts under the button (Patrícia, 2026-09-24: the
 * terms are accepted before paying). Anything but the literal `true` is
 * refused with 422 before the order is read or Stripe is touched. With it,
 * createCheckoutForOrder records the acceptance on the order (the date and
 * TERMS_VERSION of this click, rewritten on every click until the order is
 * paid, so the record is the click that paid) after the ownership and
 * payment checks and before handing out a URL. The dashboard return and the
 * webhook do not look at it.
 *
 * Statuses: 401 no session, 400 unreadable body or order id, 422 no
 * acceptance, 403 another account's order, 404 no such order, 409 already
 * paid or the price does not match, 500 anything else.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const GENERIC_ERROR = "Checkout could not be opened. Please try again.";

function error(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return error(401, "Sign in to continue.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "Invalid request.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return error(400, "Invalid request.");
  }
  const { userServiceId, acceptTerms } = body as { userServiceId?: unknown; acceptTerms?: unknown };
  if (typeof userServiceId !== "string" || !UUID.test(userServiceId)) {
    return error(400, "Invalid order reference.");
  }
  if (acceptTerms !== true) {
    return error(422, TERMS_REQUIRED);
  }

  try {
    // The return URLs are built on src/lib/site-url.ts from the request itself.
    const { url } = await createCheckoutForOrder(userServiceId, user.id, request, { version: TERMS_VERSION });
    return Response.json({ url });
  } catch (err) {
    if (err instanceof CheckoutError) {
      return error(err.status, err.message);
    }
    console.error(`POST /api/checkout failed for order ${userServiceId}:`, err);
    return error(500, GENERIC_ERROR);
  }
}
