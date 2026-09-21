import Stripe from "stripe";

/**
 * The Stripe SDK for server code: Checkout Session creation, session
 * retrieval and webhook verification.
 *
 * The secret key is read when a function is called, never at module load, so
 * `next build` and the test runner succeed with STRIPE_SECRET_KEY unset. The
 * mode (test or live) follows the key prefix, so one variable decides both:
 * sk_live_ and rk_live_ are live, everything else is test.
 * scripts/stripe-setup.mjs applies the same rule to sk_live_ only.
 *
 * No `apiVersion` is pinned: the account default applies, matching the setup
 * script, which talks to the REST API without one.
 */

export type StripeMode = "test" | "live";

let cached: { key: string; stripe: Stripe } | undefined;

/** The secret key, or a clear error naming the variable. */
export function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY must be set. See .env.example.");
  }
  return key;
}

/**
 * Prefixes of live secret keys: the full secret key (sk_) and a restricted
 * key (rk_), which production may hold instead. Anything else is test mode.
 */
const LIVE_KEY_PREFIXES = ["sk_live_", "rk_live_"] as const;

/** True when the configured key is a live key, full or restricted. */
export function isLiveMode(): boolean {
  const key = getStripeSecretKey();
  return LIVE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** "live" or "test", the suffix of the price and payment link columns. */
export function stripeMode(): StripeMode {
  return isLiveMode() ? "live" : "test";
}

/** The SDK instance, created on first use and reused while the key is unchanged. */
export function getStripe(): Stripe {
  const key = getStripeSecretKey();
  if (!cached || cached.key !== key) {
    cached = { key, stripe: new Stripe(key) };
  }
  return cached.stripe;
}
