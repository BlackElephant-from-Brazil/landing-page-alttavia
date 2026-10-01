import type { Answers, Visa } from "./types";

/**
 * Business rules the firm can change without touching the engine.
 *
 * Every value here is a default chosen on the cautious side. The open questions
 * for the client are tracked in the workspace notes (pendencias.md).
 */

/**
 * Countries the service is not available to, for the address on the proof of
 * address and for every passport on the order. The owner's list of
 * 2026-10-01 ("Lista de Paises Proibitivos"), as ISO 3166-1 alpha-2 codes;
 * every code must exist in ./countries.ts, which a test checks. To change the
 * list, edit this array and nothing else: the wizard's screens, the deep link
 * clamp and POST /api/apply/submit all read it.
 *
 * The owner's list also names Crimea, which is a region of Ukraine and not a
 * country, so it cannot be a code here. See `CRIMEA_COUNTRY` below.
 *
 * Not to be confused with `BANK_UNSUPPORTED_NATIONALITIES`, which only stops
 * the bank account and still sells the NIF.
 */
export const BLOCKED_COUNTRIES: readonly string[] = [
  "AF", // Afghanistan
  "BY", // Belarus
  "TD", // Chad
  "KP", // North Korea
  "ER", // Eritrea
  "HT", // Haiti
  "YE", // Yemen
  "IR", // Iran
  "IQ", // Iraq
  "LB", // Lebanon
  "LY", // Libya
  "ML", // Mali
  "MM", // Myanmar
  "CF", // Central African Republic
  "CD", // Congo (Democratic Republic)
  "CG", // Congo (Republic)
  "RU", // Russia
  "SY", // Syria
  "SO", // Somalia
  "SD", // Sudan
  "SS", // South Sudan
  "ZW", // Zimbabwe
  "GQ", // Equatorial Guinea
  "NI", // Nicaragua
  "TM", // Turkmenistan
  "BI", // Burundi
  "TJ", // Tajikistan
  "GW", // Guinea-Bissau
  "KH", // Cambodia
  "KG", // Kyrgyzstan
  "SZ", // Eswatini
  "SV", // El Salvador
];

/**
 * Crimea, on the owner's list, is a region of Ukraine. An address in Ukraine
 * asks the visitor to confirm it is not in Crimea (`Answers.notCrimea`) before
 * the screen can continue. The server cannot verify an address, so it only
 * holds the visitor to having ticked the box.
 */
export const CRIMEA_COUNTRY = "UA";

/** True when `code` is on the owner's list. Case insensitive, like the rest of the wizard. */
export function isBlockedCountry(code: unknown): boolean {
  return typeof code === "string" && BLOCKED_COUNTRIES.includes(code.toUpperCase());
}

/**
 * Why a country answer stops the wizard, or undefined when it does not.
 * Only the address (`residence`) and the passports (`passport`) are checked;
 * any other country question added in the database is left alone.
 *
 *   "blocked"   the country is on `BLOCKED_COUNTRIES`
 *   "crimea"    an address in Ukraine without the Crimea confirmation
 */
export type CountryIssue = "blocked" | "crimea";

export function countryIssue(answerKey: string, code: unknown, a: Answers): CountryIssue | undefined {
  if (answerKey !== "residence" && answerKey !== "passport") return undefined;
  if (isBlockedCountry(code)) return "blocked";
  if (
    answerKey === "residence" &&
    typeof code === "string" &&
    code.toUpperCase() === CRIMEA_COUNTRY &&
    a.notCrimea !== true
  ) {
    return "crimea";
  }
  return undefined;
}

/**
 * Every blocked country in these answers: the address, then each passport,
 * without repeats. Empty when the answers may go on. The submit route refuses
 * an order when this is not empty, whatever the browser claims.
 */
export function blockedCountriesIn(a: Answers): string[] {
  const codes = [a.residence, ...(Array.isArray(a.passport) ? a.passport : [])];
  const found: string[] = [];
  for (const code of codes) {
    if (!isBlockedCountry(code)) continue;
    const upper = (code as string).toUpperCase();
    if (!found.includes(upper)) found.push(upper);
  }
  return found;
}

/**
 * Passport countries the partner bank will not open an account for. Empty
 * until the firm sends the list. Codes are ISO 3166-1 alpha-2.
 */
export const BANK_UNSUPPORTED_NATIONALITIES: readonly string[] = [];

/**
 * Visa categories the partner bank accepts a file for. Non EEA applicants who
 * are not applying for any visa get the NIF recommended and a note that the
 * bank will ask for a visa in progress, which is what the service terms promise
 * ("we tell you before you buy").
 */
export const BANK_ACCEPTED_VISAS: readonly Visa[] = [
  "d1",
  "d2",
  "d3",
  "d4",
  "d5",
  "d6",
  "d7",
  "d8",
  "d9",
  "eu-family",
];
