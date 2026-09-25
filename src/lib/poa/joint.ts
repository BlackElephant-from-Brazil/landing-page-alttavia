import type { ServiceDocRow } from "@/lib/db/types";

/**
 * Which deed slots print ONE power of attorney for both persons of an order.
 *
 * The couple package opens one joint bank account, and the firm wants one
 * bank deed carrying the data of both persons, signed by both (2026-09-25).
 * Migration 0016 marks that slot `per_applicant = false`, so the order has a
 * single slot for it, and this is the rule every reader applies to it: the
 * deed route (both applicant rows required, `?applicant` ignored), and the
 * client slot, which downloads without `?applicant` and asks for both
 * persons' details when either is missing.
 *
 * All three conditions matter. Only the bank deed has a joint form; a NIF is
 * personal. A shared slot on a one person order (an admin may untick "per
 * applicant" on Bank Account only) stays that person's single deed.
 *
 * Pure and client safe: a type import, nothing else.
 */

/** The applicant positions a joint deed names, in the order it names them and they sign. */
export const JOINT_DEED_APPLICANTS = [0, 1] as const;

export function isJointDeed(
  doc: Pick<ServiceDocRow, "template" | "per_applicant">,
  applicants: number,
): boolean {
  return doc.template === "poa_bank" && !doc.per_applicant && applicants >= 2;
}

/**
 * The first person a joint deed names whose details are not on the order,
 * or null once both are: the route's own order (applicant 0 first), so the
 * client slot asks for the same person the route would name in its 409.
 */
export function jointDeedMissing(first: unknown, second: unknown): 0 | 1 | null {
  if (!first) return 0;
  if (!second) return 1;
  return null;
}
