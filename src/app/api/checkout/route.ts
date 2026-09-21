import { CheckoutError, createCheckoutForOrder } from "@/lib/stripe/checkout";
import { getUser } from "@/lib/supabase/user";

/**
 * POST /api/checkout, body `{ userServiceId }`. Contract section 8.
 *
 * Answers `{ url }` for the Pay button to navigate to, or `{ error }` with a
 * status the button can show as one line. Stripe's own error text never
 * reaches the browser: it names price ids and modes, which are ours to read
 * in the server log.
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
  const userServiceId =
    body && typeof body === "object" && "userServiceId" in body
      ? (body as { userServiceId: unknown }).userServiceId
      : undefined;
  if (typeof userServiceId !== "string" || !UUID.test(userServiceId)) {
    return error(400, "Invalid order reference.");
  }

  try {
    // The return URLs are built on src/lib/site-url.ts from the request itself.
    const { url } = await createCheckoutForOrder(userServiceId, user.id, request);
    return Response.json({ url });
  } catch (err) {
    if (err instanceof CheckoutError) {
      return error(err.status, err.message);
    }
    console.error(`POST /api/checkout failed for order ${userServiceId}:`, err);
    return error(500, GENERIC_ERROR);
  }
}
