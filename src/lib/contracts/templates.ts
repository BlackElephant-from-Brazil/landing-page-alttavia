import type { ContractTemplate } from "@/lib/db/types";

/**
 * The firm's contract models, as one list every side reads: the services
 * editor's select (editor-model.ts), the services route's validation
 * (src/lib/orders/services-admin.ts) and the agreement's own checks. Pure,
 * no imports but a type, so the browser and the server share it.
 *
 * `couple` came with 0017 (Patrícia's answer of 2026-09-24): the Couple
 * package gets one agreement naming both people, so it is prepared only once
 * applicant 0 and applicant 1 have their details on the order. Every other
 * model names one person, applicant 0.
 */

/** In the order the admin's select offers them. */
export const CONTRACT_TEMPLATES: readonly ContractTemplate[] = ["nif", "bank", "package", "couple"];

export function isContractTemplate(value: unknown): value is ContractTemplate {
  return typeof value === "string" && (CONTRACT_TEMPLATES as readonly string[]).includes(value);
}

/** How many people an agreement names: two for the Couple package, one for every other model. */
export function contractPersons(template: ContractTemplate | null | undefined): 1 | 2 {
  return template === "couple" ? 2 : 1;
}
