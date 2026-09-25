/**
 * What a client accepts by paying, and which wording it was.
 *
 * Patrícia's answer of 2026-09-24: the client accepts the terms before
 * paying. The acceptance is the Pay click itself, with this line under every
 * Pay button (src/components/dashboard/pay-terms-note.tsx), and POST
 * /api/checkout refuses a request that does not carry `acceptTerms: true`.
 * The order then records when (`user_services.terms_accepted_at`) and which
 * wording (`user_services.terms_version`, migration 0014), on every Pay
 * click until it is paid, so the record is the click that paid.
 *
 * TERMS_VERSION names the wording by the day it took effect. Bump it on the
 * day the service terms page (/en/service-terms) or the agreement models in
 * docs/terms change, so an order accepted before reads the older date. An
 * order carries the version shown at the Pay click that paid it: a click
 * after the change carries the new one, even on an order opened before it,
 * and a paid order's record is never rewritten.
 *
 * The line follows the house rules of src/content/bank-nif.ts (checked by
 * terms-version.test.ts). "your service agreement" is not a link: the
 * agreement is prepared from the client's details after payment, and its
 * copy arrives by email.
 */

export const TERMS_VERSION = "2026-09-25";

export const TERMS_ACCEPTANCE_LINE = "By paying you accept the service terms and your service agreement.";

/** What POST /api/checkout answers (422) to a request without `acceptTerms: true`. */
export const TERMS_REQUIRED = "Accept the terms to continue.";

/** The words of the line that open the service terms. */
export const TERMS_LINK_TEXT = "service terms";

/** The page those words open, in a new tab so checkout stays where it is. */
export const SERVICE_TERMS_PATH = "/en/service-terms";

/**
 * The line cut around its link, for the component that renders it. Throws
 * when the link words are not in the line, which the test catches before a
 * reworded line ships without its link.
 */
export function acceptanceLineParts(
  line: string = TERMS_ACCEPTANCE_LINE,
  link: string = TERMS_LINK_TEXT,
): { before: string; link: string; after: string } {
  const at = line.indexOf(link);
  if (at < 0) throw new Error(`acceptanceLineParts: "${link}" is not in "${line}"`);
  return { before: line.slice(0, at), link, after: line.slice(at + link.length) };
}
