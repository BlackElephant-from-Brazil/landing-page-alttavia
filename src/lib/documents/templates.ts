import type { DocTemplate, PoaTemplate } from "@/lib/db/types";

/**
 * What a document slot hands the client to sign before they upload it,
 * the value of `service_docs.template`.
 *
 *   null        an ordinary slot: the client sends a file they already have
 *   poa_nif     a power of attorney we generate for the NIF (0007)
 *   poa_bank    a power of attorney we generate for the bank account (0007)
 *   agreement   the service agreement the client signs by hand and sends
 *               back (0013_signed_agreement_slot.sql, Patrícia's answer of
 *               2026-09-24: "like the powers of attorney")
 *
 * The agreement is not generated per slot the way a deed is: it is the
 * order's one contract (src/lib/contracts/ensure.ts), downloaded from
 * GET /api/orders/[id]/contract. So a slot that reads `template` has to tell
 * the two apart before it builds a deed link, which is what these guards
 * are for.
 *
 * Pure and free of server code: the client's document slot imports it, and
 * src/lib/contracts/state.test.ts keeps the order view clear of the bucket
 * and the email sender.
 *
 * `ServiceDocRow.template` in src/lib/db/types.ts is `DocTemplate | null`;
 * the guards take any string, so a value read from elsewhere is checked on
 * what it holds.
 */

export const AGREEMENT_TEMPLATE = "agreement";

export type AgreementTemplate = typeof AGREEMENT_TEMPLATE;

/** Every value `service_docs.template` may hold, null aside (defined beside ServiceDocRow). */
export type { DocTemplate };

export const DEED_TEMPLATES: readonly PoaTemplate[] = ["poa_nif", "poa_bank"];

export const DOC_TEMPLATES: readonly DocTemplate[] = [...DEED_TEMPLATES, AGREEMENT_TEMPLATE];

/** The slot takes the signed service agreement back. */
export function isAgreementTemplate(template: string | null | undefined): template is AgreementTemplate {
  return template === AGREEMENT_TEMPLATE;
}

/** The slot generates a power of attorney of its own. */
export function isDeedTemplate(template: string | null | undefined): template is PoaTemplate {
  return typeof template === "string" && (DEED_TEMPLATES as readonly string[]).includes(template);
}
