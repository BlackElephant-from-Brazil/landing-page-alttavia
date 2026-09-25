import type {
  ContractTemplate,
  ServiceRow,
  UserServiceApplicantRow,
  UserServiceContractRow,
  UserServiceRow,
} from "@/lib/db/types";

import { contractPersons } from "./templates";

/**
 * Where an order stands with its service agreement. Pure: types only, no
 * PDF generator, no bucket, no email sender, no database client, so the
 * dashboard pages and the order views can import it without bundling what
 * src/lib/contracts/ensure.ts needs to prepare an agreement. ensure.ts
 * re-exports these names for the code that already imported them from there.
 */

export type ContractState = "off" | "needs_details" | "ready";

/** Which person of the order a set of details belongs to: 0 the account holder, 1 the partner. */
export type ApplicantIndex = 0 | 1;

/**
 * The same answer with what the agreement form needs to open the right
 * dialog.
 *
 *   missing  the first person the agreement names whose details are not on
 *            the order: 0, or 1 for the partner of the Couple package. Null
 *            when every one of them is there: the client still confirms them
 *            in the agreement form, which is the step that prepares it.
 *   persons  how many people the agreement names: 2 for `couple`, else 1.
 */
export type ContractStatus =
  | { state: "off" }
  | { state: "ready" }
  | { state: "needs_details"; missing: ApplicantIndex | null; persons: 1 | 2 };

/**
 * The first person the model names who has no details on the order, or null
 * when all of them have. The Couple package names applicant 0 and applicant
 * 1; every other model names applicant 0 alone, so a stray applicant 1 row
 * on a one person order changes nothing.
 */
export function missingContractApplicant(
  template: ContractTemplate | null | undefined,
  applicants: readonly Pick<UserServiceApplicantRow, "applicant_index">[],
): ApplicantIndex | null {
  const persons = contractPersons(template);
  for (let index = 0; index < persons; index += 1) {
    if (!applicants.some((row) => row.applicant_index === index)) return index as ApplicantIndex;
  }
  return null;
}

/**
 * For the client's order view and the admin's order modal.
 *
 *   ready          a contract row exists: it can be viewed and downloaded.
 *   off            no row, and none is coming: the service names no contract
 *                  (a custom service) or the order is not paid yet. Nothing
 *                  is shown, nothing is asked.
 *   needs_details  no row yet on a paid order whose service has a contract.
 *                  `missing` says whose details are not on the order yet
 *                  (applicant 0 first, then the Couple package's partner),
 *                  null when they all are; either way the client confirms
 *                  them in the agreement form, which prepares it.
 *
 * A row wins over everything else, so an agreement prepared before the
 * service lost its template still shows.
 */
export function contractStatus(
  order: Pick<UserServiceRow, "paid_at">,
  service: Pick<ServiceRow, "contract_template"> | null,
  applicants: readonly Pick<UserServiceApplicantRow, "applicant_index">[],
  contract: Pick<UserServiceContractRow, "id"> | null,
): ContractStatus {
  if (contract) return { state: "ready" };
  const template = service?.contract_template ?? null;
  if (!template || !order.paid_at) return { state: "off" };
  return {
    state: "needs_details",
    missing: missingContractApplicant(template, applicants),
    persons: contractPersons(template),
  };
}

/**
 * contractStatus without the detail, for the code that only branches on the
 * three states. Details typed earlier for a deed prefill the agreement form
 * but do not prepare an agreement by themselves, so an order whose details
 * are all there still answers needs_details until the client confirms them.
 */
export function contractState(
  order: Pick<UserServiceRow, "paid_at">,
  service: Pick<ServiceRow, "contract_template"> | null,
  applicants: readonly Pick<UserServiceApplicantRow, "applicant_index">[],
  contract: Pick<UserServiceContractRow, "id"> | null,
): ContractState {
  return contractStatus(order, service, applicants, contract).state;
}
