import { isProductId, type ProductId } from "@/lib/apply/types";

/**
 * What the visitor chose on the result screen, kept in sessionStorage next to
 * the answers (src/lib/apply/storage.ts) so a refresh on the email or code
 * screen does not lose the product, and the code screen still knows which
 * address the code went to.
 *
 * Re-validated field by field on read, like the answers: the branch deploys
 * on every push and a stored value may come from an older build.
 */
export const CHECKOUT_KEY = "alttavia_apply_checkout_v1";

export type CheckoutState = {
  product?: ProductId;
  email?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function sanitizeCheckout(raw: unknown): CheckoutState {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const state: CheckoutState = {};
  if (isProductId(r.product)) state.product = r.product;
  if (typeof r.email === "string" && EMAIL_PATTERN.test(r.email)) state.email = r.email;
  return state;
}

export function loadCheckout(): CheckoutState {
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_KEY);
    return raw ? sanitizeCheckout(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function saveCheckout(state: CheckoutState): void {
  try {
    window.sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full store: the flow still works, it just forgets on refresh.
  }
}

export function clearCheckout(): void {
  try {
    window.sessionStorage.removeItem(CHECKOUT_KEY);
    window.sessionStorage.removeItem(NAME_KEY);
  } catch {
    // Same as above.
  }
}

/* -------------------------------------------------------------------------- */
/* First name                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The first name typed on the email screen, kept under its own key so the
 * wizard's `saveCheckout({ ...checkout, email })` cannot drop it. Read back
 * on the code screen, written to `public.users.full_name` once the code is
 * verified, and cleared together with the rest by `clearCheckout`.
 */
export const NAME_KEY = "alttavia_apply_name_v1";

export const NAME_MAX_LENGTH = 60;

/** One line, trimmed, capped: the same rule the email screen applies. */
export function sanitizeName(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const name = raw.replace(/\s+/g, " ").trim().slice(0, NAME_MAX_LENGTH);
  return name.length > 0 ? name : undefined;
}

export function loadName(): string | undefined {
  try {
    return sanitizeName(window.sessionStorage.getItem(NAME_KEY));
  } catch {
    return undefined;
  }
}

export function saveName(name: string | undefined): void {
  try {
    const clean = sanitizeName(name);
    if (clean) window.sessionStorage.setItem(NAME_KEY, clean);
    else window.sessionStorage.removeItem(NAME_KEY);
  } catch {
    // Private mode or a full store: the profile simply keeps no name.
  }
}
