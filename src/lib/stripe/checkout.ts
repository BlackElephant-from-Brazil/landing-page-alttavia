import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ServiceRow, UserRow, UserServiceRow } from "@/lib/db/types";
import { siteOrigin, siteOriginFrom, type RequestLike } from "@/lib/site-url";
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
 * the site. A mode with no price id yet (live, until `stripe:setup --live` is
 * run) falls back to that mode's Payment Link.
 *
 * Where "back to the site" is: src/lib/site-url.ts. NEXT_PUBLIC_SITE_URL when
 * set; otherwise the origin the browser used (localhost and LAN included,
 * never 0.0.0.0); on Netlify's production deploy a missing variable throws
 * before anything is sent to Stripe. The third argument is the request
 * (preferred) or an origin string the route already worked out; both go
 * through the same rule.
 *
 * The fourth is the client's acceptance of the service terms and the
 * service agreement (Patrícia, 2026-09-24: accepted before paying). It is
 * required, so no caller can open a checkout without it. It is written on
 * the order, on every Pay click of an unpaid order, once every check of ours
 * has passed and before the buyer gets a URL: after the price check, before
 * a session is reused or created, and before a Payment Link is handed out.
 * See recordTermsAcceptance below.
 *
 * Every session is created with Adaptive Pricing off: the prices on the site
 * are euros with VAT included, and a buyer from abroad paying in their own
 * currency would pay a converted amount the firm never quoted. An open
 * session made before this rule (the dashboard setting applied then) is not
 * reused when it has Adaptive Pricing on. The Payment Link fallback cannot
 * carry the setting per session; the Stripe dashboard setting applies there.
 */

/** What the route passes once the body carried `acceptTerms: true`. */
export type TermsAcceptance = {
  /** TERMS_VERSION from src/content/terms-version.ts. */
  version: string;
  /** The clock, for tests. */
  now?: Date;
};

type AdminClient = ReturnType<typeof createAdminClient>;

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

/** What the buyer reads when the service's Stripe price does not match the order. */
export const PRICE_MISMATCH = "This service cannot be paid for right now. Write to us and we will sort it out.";

/**
 * Writes the client's acceptance on the order: `terms_accepted_at` now and
 * `terms_version` the version accepted, on every Pay click while the order
 * is unpaid (changed 2026-09-25). The record is therefore the click that led
 * to the payment: a client who clicked Pay, left, and paid after
 * TERMS_VERSION moved on accepted the newer wording on that last click, and
 * the order says so. Once the order is paid the record is frozen: the update
 * is conditional on `paid_at is null`, and createCheckoutForOrder refuses a
 * paid order before it gets here.
 *
 * Called only after createCheckoutForOrder has confirmed the order belongs
 * to the caller and is unpaid; the owner filter on the update repeats that
 * for the write itself. A database error throws, so no buyer reaches Stripe
 * without the record (the route answers its generic 500).
 *
 * Answers "recorded" when this call wrote it and "kept" when nothing was
 * written because the order was paid in the meantime (or is not the
 * caller's), so the record it already had stands.
 */
export async function recordTermsAcceptance(
  admin: AdminClient,
  order: UserServiceRow,
  acceptance: TermsAcceptance,
): Promise<"recorded" | "kept"> {
  const at = (acceptance.now ?? new Date()).toISOString();
  const { data, error } = await admin
    .from("user_services")
    .update({ terms_accepted_at: at, terms_version: acceptance.version })
    .eq("id", order.id)
    .eq("user_id", order.user_id)
    .is("paid_at", null)
    .select("id");
  if (error) throw new Error(`recordTermsAcceptance: ${error.message}`);
  // No row: the order was paid a moment ago, and the record of the click that paid it stands.
  if (!data || data.length === 0) return "kept";

  console.info(`checkout: order ${order.id} accepted the service terms version ${acceptance.version} at ${at}`);
  return "recorded";
}

export async function createCheckoutForOrder(
  userServiceId: string,
  userId: string,
  from: RequestLike | string,
  acceptance: TermsAcceptance,
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

  if (priceId) {
    // Worked out before Stripe is touched, so a missing site URL on the
    // production deploy stops here instead of after a session was expired.
    const base = typeof from === "string" ? siteOriginFrom(from) : siteOrigin(from);
    const stripe = getStripe();

    // Stripe charges what the price id costs; the order records what the
    // service costs. Both checks that mark an order paid compare the session
    // with the order (src/lib/stripe/confirm.ts), so a price id that costs
    // something else (a wrong id pasted in the editor, a price changed on one
    // side only) would take the money and leave the order unpaid with the
    // Pay button still there. Refused before any session is created or
    // reused, so an old open session at the wrong price is never handed out.
    const price = await stripe.prices.retrieve(priceId);
    if (price.unit_amount !== order.total_cents || price.currency.toLowerCase() !== order.currency.toLowerCase()) {
      console.error(
        `createCheckoutForOrder: ${mode} price of ${service.slug} is ${price.unit_amount} ${price.currency}, ` +
          `order ${order.id} expects ${order.total_cents} ${order.currency}; checkout refused`,
      );
      throw new CheckoutError(409, PRICE_MISMATCH);
    }

    // Every check of ours has passed: the buyer is about to get a URL.
    await recordTermsAcceptance(admin, order, acceptance);

    // A buyer who clicked Pay, closed Stripe and clicked again should land on
    // the session they already have, not on a second one that could also be
    // paid. An open session with a url is reused, unless it was made with
    // Adaptive Pricing on (before 2026-09-25 the dashboard setting decided);
    // anything else is expired (best effort) before a new one is created.
    if (order.stripe_checkout_session_id) {
      const existingId = order.stripe_checkout_session_id;
      const existing = await stripe.checkout.sessions.retrieve(existingId).catch(() => null);
      if (existing && existing.status === "open" && existing.url && existing.adaptive_pricing?.enabled !== true) {
        return { url: existing.url };
      }
      await stripe.checkout.sessions.expire(existingId).catch(() => {});
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Always charged in euros, the currency of the price and of the order.
      adaptive_pricing: { enabled: false },
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

  await recordTermsAcceptance(admin, order, acceptance);

  const url = new URL(link);
  url.searchParams.set("client_reference_id", order.id);
  url.searchParams.set("prefilled_email", email);
  return { url: url.toString() };
}
