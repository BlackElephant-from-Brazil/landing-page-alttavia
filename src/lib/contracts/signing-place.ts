import { LATIN_LETTERS_MESSAGE } from "@/lib/orders/applicant-rules";
import { unprintable } from "@/lib/pdf/characters";

/**
 * The optional signing place of Annex I, Part A ("[PLACE]"): the field "City
 * and country you are in today" of the agreement form. Pure, so the form runs
 * it before it opens the tab the agreement lands in and the route runs it
 * again on what arrives. src/lib/contracts/ensure.ts re-exports it.
 */

export const MAX_SIGNING_PLACE_LENGTH = 120;

export type SigningPlaceResult =
  | { ok: true; value: string | null }
  | { ok: false; status: 400 | 422; message: string };

const INVALID_BODY = "Check the details and try again.";
const SIGNING_PLACE_TOO_LONG = `Keep the city and country under ${MAX_SIGNING_PLACE_LENGTH} characters.`;

/** Tab and line breaks: a space, so a pasted "Austin\nUSA" keeps its gap. */
const BREAKS = /[\t\n\r\u2028\u2029]/g;
/** The other C0 and C1 controls, DEL, zero width characters and the byte order mark: nothing. */
const CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g;

/**
 * "City and country you are in today", as the form posts it. Missing, null
 * or blank is no place at all (the annex then prints a rule to fill in by
 * hand). Text is cleaned before it is measured, in characters: composed
 * (NFC), line breaks become a space, control and zero width characters are
 * dropped, runs of spaces collapse. Anything that is not text is a 400; more
 * than 120 characters, or a character the agreement could not print
 * (Cyrillic, Chinese, Arabic), a 422 with a line the form can show.
 */
export function parseSigningPlace(raw: unknown): SigningPlaceResult {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, status: 400, message: INVALID_BODY };
  const cleaned = raw.normalize("NFC").replace(BREAKS, " ").replace(CONTROLS, "").replace(/ {2,}/g, " ").trim();
  if (!cleaned) return { ok: true, value: null };
  if (Array.from(cleaned).length > MAX_SIGNING_PLACE_LENGTH) {
    return { ok: false, status: 422, message: SIGNING_PLACE_TOO_LONG };
  }
  if (unprintable(cleaned).length > 0) return { ok: false, status: 422, message: LATIN_LETTERS_MESSAGE };
  return { ok: true, value: cleaned };
}
