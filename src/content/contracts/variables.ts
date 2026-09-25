/**
 * The variables of the contract for legal services: every bracketed token
 * the firm's models hold (docs/terms, read into models.generated.ts) and
 * where its value comes from. docs/agreement-contract.md section 2 is the
 * table this file implements.
 *
 * FIRM_CONSTANTS are values the models leave open and the platform cannot
 * know from an order: how long the tax representation lasts, how many banks
 * are approached, which address a withdrawal is sent to. Patrícia confirmed
 * the first two on 2026-09-24. Change them here and nowhere else.
 *
 * The applicant's nine fields are the same ones the powers of attorney use,
 * so the client is asked once. Nothing here edits the models' wording: a
 * token with no value is left out of the record and prints as the model's
 * own bracket.
 *
 * The Couple package (2026-09-24) is one contract for two persons. Its model
 * names the second person with the first person's tokens plus " 2"
 * ([FULL NAME 2], [PASSPORT NO. 2]…), filled from applicant 1; the email is
 * the account's, shared by both. Every other model names applicant 0 alone.
 *
 * It does not import the generated models, which are large and belong to the
 * server; models.test.ts holds this file and the models to each other.
 */

import { CONTACT } from "@/content/bank-nif";
import { formatDeedDate, signingDateFor } from "@/content/power-of-attorney";
import type { ContractTemplate, ServiceRow, UserServiceApplicantRow, UserServiceRow } from "@/lib/db/types";
import { euroAmount, euroWords } from "@/lib/contracts/words";
import { asciiLetters, transliterate } from "@/lib/pdf/characters";

/** Keyed by the token as written in the model, brackets included: `"[FULL NAME]"`. */
export type ContractValues = Record<string, string>;

/**
 * Values the models leave open. `representationPeriod` and `numberOfBanks`
 * were confirmed by Patrícia on 2026-09-24 (docs/agreement-contract.md
 * section 8).
 */
export const FIRM_CONSTANTS = {
  /** [REPRESENTATION PERIOD], Fourth Clause of the NIF, package and couple contracts. */
  representationPeriod: "12 (twelve) months",
  /** [NUMBER OF BANKS], Third Clause of the bank, package and couple contracts. */
  numberOfBanks: "1 (one)",
  /** [EMAIL OF THE SECOND PARTY], Annex I parts B and C. */
  secondPartyEmail: CONTACT.email,
} as const;

const SERVICE_TOKEN = "[SERVICE: NIF / BANK ACCOUNT / NIF + BANK ACCOUNT PACKAGE]";

/** The eight tokens filled from applicant 0's details, in the order the contract prints them. */
export const APPLICANT_TOKENS: readonly string[] = [
  "[FULL NAME]",
  "[PLACE OF BIRTH]",
  "[DATE OF BIRTH]",
  "[PASSPORT NO.]",
  "[PASSPORT ISSUING AUTHORITY]",
  "[DATE OF ISSUE]",
  "[EXPIRY DATE]",
  "[TAX RESIDENCE ADDRESS]",
];

/** The second person's token for one of the first person's: `[FULL NAME]` becomes `[FULL NAME 2]`. */
export function partnerToken(token: string): string {
  return token.replace(/\]$/, " 2]");
}

/** The eight tokens the Couple package fills from applicant 1, the partner, in the same order. */
export const PARTNER_TOKENS: readonly string[] = APPLICANT_TOKENS.map(partnerToken);

/**
 * Every token the five models use. A model that arrives with a token missing
 * from this list fails models.test.ts, so a new placeholder is never printed
 * as a bracket by accident.
 */
export const KNOWN_TOKENS: readonly string[] = [
  ...APPLICANT_TOKENS,
  "[EMAIL]",
  "[TOTAL FEE]",
  "[FEE IN WORDS]",
  "[REPRESENTATION PERIOD]",
  "[NUMBER OF BANKS]",
  "[DAY]",
  "[MONTH]",
  "[YEAR]",
  SERVICE_TOKEN,
  "[EMAIL OF THE SECOND PARTY]",
  "[PLACE]",
  ...PARTNER_TOKENS,
];

const SERVICE_LABEL: Record<ContractTemplate, string> = {
  nif: "NIF",
  bank: "BANK ACCOUNT",
  package: "NIF + BANK ACCOUNT PACKAGE",
  couple: "COUPLE PACKAGE",
};

/** The service as Annex I names it, in the model's own capitals. */
export function contractServiceLabel(template: ContractTemplate): string {
  return SERVICE_LABEL[template];
}

/** A contract cannot be filled from what it was given; the message says what is missing. */
export class ContractValuesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractValuesError";
  }
}

/**
 * What an order gives the contract: the order (fee, payment date), the
 * service (its contract template), the applicants in applicant order
 * (`applicants[0]` the first person, `applicants[1]` the partner of the
 * Couple package), the account's email and the optional signing place.
 */
export type ContractValuesInput = {
  order: Pick<UserServiceRow, "total_cents" | "paid_at">;
  service: Pick<ServiceRow, "slug" | "name" | "contract_template">;
  applicants: readonly UserServiceApplicantRow[];
  email: string | null;
  signingPlace?: string | null;
};

/**
 * The same facts given one by one rather than as an order: the template,
 * applicant 0, `partner` (applicant 1, printed by the Couple package only),
 * the account's email, the fee in cents, the payment date and the signing
 * place. buildContractValuesFromFields takes it, for the scripts that build
 * agreements for demo data (seed-demo.mjs, seed-history.mjs) and for tests;
 * the platform goes through buildContractValues with the order.
 */
export type ContractFields = {
  template: ContractTemplate;
  applicant: UserServiceApplicantRow | null;
  partner?: UserServiceApplicantRow | null;
  email: string | null;
  totalCents: number;
  paidAt: string | null;
  signingPlace?: string | null;
};

type Fill = {
  template: ContractTemplate;
  first: UserServiceApplicantRow | null;
  second: UserServiceApplicantRow | null;
  email: string | null;
  totalCents: number;
  paidAt: string | null;
  signingPlace: string | null;
};


/**
 * One line, single spaces: a value is printed inside a sentence. Empty counts
 * as missing. A value holding a letter the PDF fonts lack is spelled in plain
 * ASCII letters throughout (transliterate), the way a passport's machine
 * readable line would, so "Łukasz Żółć" prints "Lukasz Zolc" and never the
 * half accented "Lukasz Zólc". A value the fonts can spell keeps its accents.
 */
function clean(value: string | null | undefined): string | undefined {
  const text = transliterate((value ?? "").replace(/\s+/g, " ").trim());
  return text.length > 0 ? text : undefined;
}

/** The eight printed values of one person, under `tokens` (the first person's or the partner's). */
function personValues(applicant: UserServiceApplicantRow, tokens: readonly string[]): [string, string | null | undefined][] {
  const fields = [
    applicant.full_name,
    applicant.birth_place,
    formatDeedDate(applicant.birth_date ?? "", "en"),
    applicant.passport_number,
    applicant.passport_issuer,
    formatDeedDate(applicant.passport_issued_on ?? "", "en"),
    formatDeedDate(applicant.passport_expires_on ?? "", "en"),
    applicant.tax_address,
  ];
  return tokens.map((token, index) => [token, fields[index]]);
}

function fill(input: Fill): ContractValues {
  const { template } = input;
  const values: ContractValues = {};
  const set = (token: string, value: string | null | undefined) => {
    const text = clean(value);
    if (text !== undefined) values[token] = text;
  };

  if (input.first) for (const [token, value] of personValues(input.first, APPLICANT_TOKENS)) set(token, value);
  // Only the Couple package names a second person; a partner row on any other order is not printed.
  if (template === "couple" && input.second) {
    for (const [token, value] of personValues(input.second, PARTNER_TOKENS)) set(token, value);
  }
  set("[EMAIL]", input.email);

  if (Number.isFinite(input.totalCents) && input.totalCents >= 0) {
    set("[TOTAL FEE]", euroAmount(input.totalCents));
    set("[FEE IN WORDS]", euroWords(input.totalCents));
  }

  // The bank contract has no tax representation and the NIF contract
  // approaches no bank; models.test.ts holds this to the models.
  if (template !== "bank") set("[REPRESENTATION PERIOD]", FIRM_CONSTANTS.representationPeriod);
  if (template !== "nif") set("[NUMBER OF BANKS]", FIRM_CONSTANTS.numberOfBanks);

  const paid = input.paidAt ? new Date(input.paidAt) : null;
  if (paid && !Number.isNaN(paid.getTime())) {
    const { day, monthEn, year } = signingDateFor(paid);
    set("[DAY]", day);
    set("[MONTH]", monthEn);
    set("[YEAR]", year);
  }

  set(SERVICE_TOKEN, contractServiceLabel(template));
  set("[EMAIL OF THE SECOND PARTY]", FIRM_CONSTANTS.secondPartyEmail);
  set("[PLACE]", input.signingPlace);

  return values;
}

/**
 * The values of one contract. Only tokens that have a value are returned,
 * and only tokens the template (or Annex I) prints, so the record stored in
 * `user_service_contracts.variables` is exactly what was printed, letter for
 * letter: the transliteration happens here, on the values, and never inside
 * the word wrap, so the firm's own text is untouched.
 *
 * Dates read `12 March 2026`. [DAY] [MONTH] [YEAR] come from the payment
 * date as the calendar reads in Lisbon, where the contract is "done".
 *
 * Throws ContractValuesError for a service with no contract template, and
 * for the Couple package when `applicants[1]`, the partner, is missing: a
 * contract for two persons is never prepared with one. A missing applicant 0
 * is not an error here (the contract keeps its brackets); ensureContract
 * asks for the details before it generates anything.
 */
export function buildContractValues(input: ContractValuesInput): ContractValues {
  const template = input.service.contract_template;
  if (!template) throw new ContractValuesError(`The service ${input.service.slug || input.service.name} has no contract template.`);
  return fillBoth({
    template,
    first: input.applicants[0] ?? null,
    second: input.applicants[1] ?? null,
    email: input.email,
    totalCents: input.order.total_cents,
    paidAt: input.order.paid_at,
    signingPlace: input.signingPlace ?? null,
  });
}

/**
 * buildContractValues from the facts one by one (ContractFields), with the
 * same rules: the Couple package without `partner` throws
 * ContractValuesError, a missing `applicant` keeps its brackets.
 */
export function buildContractValuesFromFields(fields: ContractFields): ContractValues {
  return fillBoth({
    template: fields.template,
    first: fields.applicant,
    second: fields.partner ?? null,
    email: fields.email,
    totalCents: fields.totalCents,
    paidAt: fields.paidAt,
    signingPlace: fields.signingPlace ?? null,
  });
}

/** fill, refusing a Couple package agreement that names one person. */
function fillBoth(params: Fill): ContractValues {
  if (params.template === "couple" && !params.second) {
    throw new ContractValuesError(
      "The Couple package agreement names both persons: the partner's details (applicant 1) are missing.",
    );
  }
  return fill(params);
}

/**
 * Which of the applicants' tokens would print differently today than they
 * did in the agreement on record. `printed` is the row's `variables`, what
 * that version really says; the other side is rebuilt from the details as
 * they stand, through the same cleaning and the same spelling.
 *
 * `applicants` is applicant 0's row, or the applicants in applicant order.
 * The first person's eight tokens are always compared; for the Couple package
 * the partner's eight are compared too, when applicant 1's row is given.
 *
 * The client can still change the details after the agreement exists
 * ("Edit your details" on a deed slot): the deeds then print the new details
 * and the agreement keeps the old ones. This is how the firm gets told.
 * Values are compared, never timestamps: the row's `updated_at` moves on
 * every save, changed or not.
 *
 * Empty when nothing differs, and when there are no details to compare with.
 */
export function contractDrift(
  printed: ContractValues | null | undefined,
  template: ContractTemplate,
  applicants: UserServiceApplicantRow | readonly UserServiceApplicantRow[] | null,
): string[] {
  const list: readonly (UserServiceApplicantRow | null | undefined)[] = Array.isArray(applicants)
    ? applicants
    : [applicants as UserServiceApplicantRow | null];
  const first = list[0] ?? null;
  if (!first) return [];
  const second = template === "couple" ? (list[1] ?? null) : null;

  const was = printed ?? {};
  const current = fill({ template, first, second, email: null, totalCents: 0, paidAt: null, signingPlace: null });
  const tokens = second ? [...APPLICANT_TOKENS, ...PARTNER_TOKENS] : APPLICANT_TOKENS;
  return tokens.filter((token) => (was[token] ?? "") !== (current[token] ?? ""));
}

const SLUG_MAX_LENGTH = 60;

/**
 * `service-agreement-nif-jane-doe.pdf`: the template, then the name folded
 * to ASCII letters, digits and hyphens, cut at 60 characters. Safe inside a
 * Content-Disposition header whatever was typed: no quote, no line break,
 * nothing outside ASCII. A name with nothing to keep drops the suffix. The
 * Couple package takes the first person's name.
 */
export function contractFileName(template: ContractTemplate, fullName: string | null): string {
  const slug = asciiLetters(fullName ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, "");
  return slug ? `service-agreement-${template}-${slug}.pdf` : `service-agreement-${template}.pdf`;
}
