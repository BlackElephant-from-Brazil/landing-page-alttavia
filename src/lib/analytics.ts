/**
 * Funnel events for the apply wizard.
 *
 * Everything is pushed to `window.dataLayer`, the queue Google Tag Manager
 * reads. Nothing here loads a script or sends a request: when no container is
 * configured the pushes pile up in an array nobody reads, which costs nothing
 * and keeps the call sites free of conditionals.
 *
 * No event carries personal data, because the wizard collects none. The
 * country and visa fields describe a case, not a person.
 */

type DataLayerEvent = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: DataLayerEvent[];
  }
}

function push(event: DataLayerEvent) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(event);
}

/** A question screen came into view. `step` is 1 based, as the visitor sees it. */
export function trackStep(step: number, total: number, id: string) {
  push({ event: "apply_step", apply_step: step, apply_total: total, apply_screen: id });
}

/** The result screen rendered a product. Fires once per arrival at the result. */
export function trackRecommendation(product: string, quantity: number, totalCents: number) {
  push({
    event: "apply_recommendation",
    apply_product: product,
    apply_quantity: quantity,
    value: totalCents / 100,
    currency: "EUR",
  });
}

/** The visitor left for a payment link or for WhatsApp. */
export function trackCheckoutClick(product: string, totalCents: number, destination: "stripe" | "whatsapp") {
  push({
    event: "begin_checkout",
    apply_product: product,
    apply_destination: destination,
    value: totalCents / 100,
    currency: "EUR",
  });
}

/** The answers ruled this visitor out, or ruled out what they asked for. */
export function trackExit(reason: string) {
  push({ event: "apply_exit", apply_exit: reason });
}

/** Stripe sent the buyer back to the success page. */
export function trackPurchase(reference?: string) {
  push({ event: "purchase_landed", apply_reference: reference });
}
