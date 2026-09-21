/**
 * The variables of the contract for legal services: every bracketed token
 * the firm's models hold (docs/terms, read into models.generated.ts) and
 * where its value comes from. docs/agreement-contract.md section 2 is the
 * table this file implements.
 *
 * FIRM_CONSTANTS are the firm's to confirm. They are values the models leave
 * open and the platform cannot know from an order: how long the tax
 * representation lasts, how many banks are approached, which address a
 * withdrawal is sent to. Change them here and nowhere else.
 *
 * The applicant's nine fields are the same ones the powers of attorney use,
 * so the client is asked once. Nothing here edits the models' wording: a
 * token with no value is left out of the record and prints as the model's
 * own bracket.
 *
 * It does not import the generated models, which are large and belong to the
 * server; models.test.ts holds this file and the models to each other.
 */

import { CONTACT } from "@/content/bank-nif";
import { formatDeedDate, signingDateFor } from "@/content/power-of-attorney";
import type { ContractTemplate, UserServiceApplicantRow } from "@/lib/db/types";
import { euroAmount, euroWords } from "@/lib/contracts/words";
import { asciiLetters, transliterate } from "@/lib/pdf/characters";

/** Keyed by the token as written in the model, brackets included: `"[FULL NAME]"`. */
export type ContractValues = Record<string, string>;

/**
 * To be confirmed by the firm (docs/agreement-contract.md section 8).
 * `representationPeriod` follows the landing page, which sells 12 months of
 * tax representation with the NIF.
 */
export const FIRM_CONSTANTS = {
  /** [REPRESENTATION PERIOD], Fourth Clause of the NIF and package contracts. */
  representationPeriod: "12 (twelve) months",
  /** [NUMBER OF BANKS], Third Clause of the bank and package contracts. */
  numberOfBanks: "1 (one)",
  /** [EMAIL OF THE SECOND PARTY], Annex I parts B and C. */
  secondPartyEmail: CONTACT.email,
} as const;

const SERVICE_TOKEN = "[SERVICE: NIF / BANK ACCOUNT / NIF + BANK ACCOUNT PACKAGE]";

/**
 * Every token the four models use. A model that arrives with a token missing
 * from this list fails models.test.ts, so a new placeholder is never printed
 * as a bracket by accident.
 */
export const KNOWN_TOKENS: readonly string[] = [
  "[FULL NAME]",
  "[PLACE OF BIRTH]",
  "[DATE OF BIRTH]",
  "[PASSPORT NO.]",
  "[PASSPORT ISSUING AUTHORITY]",
  "[DATE OF ISSUE]",
  "[EXPIRY DATE]",
  "[TAX RESIDENCE ADDRESS]",
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
];

const SERVICE_LABEL: Record<ContractTemplate, string> = {
  nif: "NIF",
  bank: "BANK ACCOUNT",
  package: "NIF + BANK ACCOUNT PACKAGE",
};

/** The service as Annex I names it, in the model's own capitals. */
export function contractServiceLabel(template: ContractTemplate): string {
  return SERVICE_LABEL[template];
}

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

/**
 * The values of one contract. Only tokens that have a value are returned,
 * and only tokens the template (or Annex I) prints, so the record stored in
 * `user_service_contracts.variables` is exactly what was printed, letter for
 * letter: the transliteration happens here, on the values, and never inside
 * the word wrap, so the firm's own text is untouched.
 *
 * Dates read `12 March 2026`. [DAY] [MONTH] [YEAR] come from the payment
 * date as the calendar reads in Lisbon, where the contract is "done".
 */
export function buildContractValues(input: {
  template: ContractTemplate;
  applicant: UserServiceApplicantRow | null;
  email: string | null;
  totalCents: number;
  paidAt: string | null;
  signingPlace?: string | null;
}): ContractValues {
  const { template, applicant } = input;
  const values: ContractValues = {};
  const set = (token: string, value: string | null | undefined) => {
    const text = clean(value);
    if (text !== undefined) values[token] = text;
  };

  if (applicant) {
    set("[FULL NAME]", applicant.full_name);
    set("[PLACE OF BIRTH]", applicant.birth_place);
    set("[DATE OF BIRTH]", formatDeedDate(applicant.birth_date ?? "", "en"));
    set("[PASSPORT NO.]", applicant.passport_number);
    set("[PASSPORT ISSUING AUTHORITY]", applicant.passport_issuer);
    set("[DATE OF ISSUE]", formatDeedDate(applicant.passport_issued_on ?? "", "en"));
    set("[EXPIRY DATE]", formatDeedDate(applicant.passport_expires_on ?? "", "en"));
    set("[TAX RESIDENCE ADDRESS]", applicant.tax_address);
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

/**
 * Which of the applicant's tokens would print differently today than they
 * did in the agreement on record. `printed` is the row's `variables`, what
 * that version really says; the other side is rebuilt from the details as
 * they stand, through buildContractValues, so both went through the same
 * cleaning and the same spelling.
 *
 * The client can still change applicant 0 after the agreement exists
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
  applicant: UserServiceApplicantRow | null,
): string[] {
  if (!applicant) return [];
  const was = printed ?? {};
  const current = buildContractValues({ template, applicant, email: null, totalCents: 0, paidAt: null });
  return APPLICANT_TOKENS.filter((token) => (was[token] ?? "") !== (current[token] ?? ""));
}

const SLUG_MAX_LENGTH = 60;

/**
 * `service-agreement-nif-jane-doe.pdf`: the template, then the name folded
 * to ASCII letters, digits and hyphens, cut at 60 characters. Safe inside a
 * Content-Disposition header whatever was typed: no quote, no line break,
 * nothing outside ASCII. A name with nothing to keep drops the suffix.
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
