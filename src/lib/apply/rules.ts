import type { Visa } from "./types";

/**
 * Business rules the firm can change without touching the engine.
 *
 * Every value here is a default chosen on the cautious side. The open questions
 * for the client are tracked in the workspace notes (pendencias.md).
 */

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
