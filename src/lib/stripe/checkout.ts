import { createAdminClient } from "@/lib/supabase/admin";
import type { ServiceRow, UserRow, UserServiceRow } from "@/lib/db/types";
import { getStripe, stripeMode } from "./client";

/**
 * Opens a Stripe hosted checkout for an existing order. Contract section 8.
 *
 * The order was created by POST /api/apply/submit after the server ran the
 * decision engine, so the product and the total are already trusted values
 * in the database. Nothing from the browser is used here beyond the order
 * id, and only after the order is confirmed to belong to the caller. Every
 * order is one unit of its service.
 *
 * Checkout Sessions are preferred: they carry the order id as
 * `client_reference_id`, lock the buyer's email and send the buyer back to
 * whatever origin the request came from, localhost included. A mode with no
 * price id yet (live, until `stripe:setup --live` is run) falls back to that
 * mode's Payment Link.
 */

/** An error the route can turn into a status code and a short message. */
export class CheckoutError extends Error {
  readonly status: 403 | 404 | 409 | 500;

  constructor(status: 403 | 404 | 409 | 500, message: string) {
    super(message);
    this.name = "CheckoutError";
    this.status = status;
  }
}

export type CheckoutResult = { url: string };

export async function createCheckoutForOrder(
  userServiceId: string,
  userId: string,
  origin: string,
): Promise<CheckoutResult> {
  const admin = createAdminClient();

  const { data: orderRow, error: orderError } = await admin
    .from("user_services")
    .select("*")
    .eq("id", userServiceId)
    .maybeSingle();
  if (orderError) throw new Error(`createCheckoutForOrder: ${orderError.message}`);
  const order = orderRow as UserServiceRow | null;
  if (!order) throw new CheckoutError(404, "Order not found.");
  if (order.user_id !== userId) throw new CheckoutError(403, "This order belongs to another account.");
  if (order.paid_at) throw new CheckoutError(409, "This order is already paid.");

  const { data: serviceRow, error: serviceError } = await admin
    .from("services")
    .select("*")
    .eq("id", order.service_id)
    .maybeSingle();
  if (serviceError) throw new Error(`createCheckoutForOrder: ${serviceError.message}`);
  const service = serviceRow as ServiceRow | null;
  if (!service) throw new Error(`createCheckoutForOrder: service ${order.service_id} not found`);

  const { data: userRow, error: userError } = await admin
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (userError) throw new Error(`createCheckoutForOrder: ${userError.message}`);
  const email = (userRow as Pick<UserRow, "email"> | null)?.email;
  if (!email) throw new Error(`createCheckoutForOrder: user ${userId} has no profile row`);

  const mode = stripeMode();
  const priceId = mode === "live" ? service.stripe_price_id_live : service.stripe_price_id_test;
  const base = origin.replace(/\/+$/, "");

  if (priceId) {
    const stripe = getStripe();

    // A buyer who clicked Pay, closed Stripe and clicked again should land on
    // the session they already have, not on a second one that could also be
    // paid. An open session with a url is reused; anything else is expired
    // (best effort) before a new one is created.
    if (order.stripe_checkout_session_id) {
      const existingId = order.stripe_checkout_session_id;
      const existing = await stripe.checkout.sessions.retrieve(existingId).catch(() => null);
      if (existing && existing.status === "open" && existing.url) {
        return { url: existing.url };
      }
      await stripe.checkout.sessions.expire(existingId).catch(() => {});
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: order.id,
      customer_email: email,
      success_url: `${base}/en/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/en/dashboard?checkout=cancelled`,
      metadata: {
        user_service_id: order.id,
        user_id: userId,
        service_slug: service.slug,
      },
    });
    if (!session.url) {
      throw new Error(`createCheckoutForOrder: session ${session.id} has no url`);
    }

    const { error: saveError } = await admin
      .from("user_services")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", order.id)
      .is("paid_at", null);
    if (saveError) throw new Error(`createCheckoutForOrder: ${saveError.message}`);

    return { url: session.url };
  }

  const link = mode === "live" ? service.stripe_payment_link_live : service.stripe_payment_link_test;
  if (!link) {
    throw new Error(
      `createCheckoutForOrder: service ${service.slug} has neither a price id nor a payment link for ${mode} mode`,
    );
  }

  const url = new URL(link);
  url.searchParams.set("client_reference_id", order.id);
  url.searchParams.set("prefilled_email", email);
  return { url: url.toString() };
}
