import Stripe from "stripe";

/**
 * The Stripe SDK for server code: Checkout Session creation, session
 * retrieval and webhook verification.
 *
 * The secret key is read when a function is called, never at module load, so
 * `next build` and the test runner succeed with STRIPE_SECRET_KEY unset. The
 * mode (test or live) follows the key prefix, the same rule
 * scripts/stripe-setup.mjs applies, so one variable decides both.
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

/** True when the configured key is a live key. */
export function isLiveMode(): boolean {
  return getStripeSecretKey().startsWith("sk_live_");
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
