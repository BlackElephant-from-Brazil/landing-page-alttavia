import type { ServiceRow, UserServiceApplicantRow, UserServiceContractRow, UserServiceRow } from "@/lib/db/types";

/**
 * Where an order stands with its service agreement. Pure: types only, no
 * PDF generator, no bucket, no email sender, no database client, so the
 * dashboard pages and the order views can import it without bundling what
 * src/lib/contracts/ensure.ts needs to prepare an agreement. ensure.ts
 * re-exports both names for the code that already imported them from there.
 */

export type ContractState = "off" | "needs_details" | "ready";

/**
 * For the client's order view and the admin's order modal.
 *
 *   ready          a contract row exists: it can be viewed and downloaded.
 *   off            no row, and none is coming: the service names no contract
 *                  (the Couple package, a custom service) or the order is
 *                  not paid yet. Nothing is shown, nothing is asked.
 *   needs_details  no row yet on a paid order whose service has a contract:
 *                  the client still has to confirm their details in the
 *                  agreement form, which is the step that prepares it.
 *
 * A row wins over everything else, so an agreement prepared before the
 * service lost its template still shows. `applicants` is part of the
 * signature the design names; details typed earlier for a deed prefill the
 * form but do not prepare an agreement by themselves, so they do not change
 * the answer.
 */
export function contractState(
  order: Pick<UserServiceRow, "paid_at">,
  service: Pick<ServiceRow, "contract_template"> | null,
  _applicants: readonly Pick<UserServiceApplicantRow, "applicant_index">[],
  contract: Pick<UserServiceContractRow, "id"> | null,
): ContractState {
  if (contract) return "ready";
  if (!service?.contract_template || !order.paid_at) return "off";
  return "needs_details";
}
