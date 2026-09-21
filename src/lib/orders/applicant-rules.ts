import { lisbonIsoDate } from "@/lib/dates/lisbon";
import type { ApplicantGender, UserServiceApplicantRow } from "@/lib/db/types";
import { unprintable } from "@/lib/pdf/characters";

/**
 * The rules the principal's details must pass, as a pure function with no
 * database, no `server-only` and no PDF library behind it, so the same code
 * runs in two places:
 *
 *   the route   PUT /api/orders/[id]/applicants/[index] (through
 *               src/lib/orders/applicants.ts), which is the check that counts;
 *   the form    applicant-details-form.tsx, before it saves and before it
 *               opens the tab the agreement lands in, so a refusal the
 *               browser could have predicted never leaves a blank tab behind.
 *
 *   validateApplicantInput(body) -> { ok, value } | { ok: false, status: 422, message }
 *
 * The body may use the form's camelCase keys (`fullName`, `birthPlace`,
 * `passportIssueDate` or `passportIssuedOn`, `passportExpiryDate` or
 * `passportExpiresOn`, `taxAddress`) or the column names; the value that
 * comes back is in column names, ready to upsert. Text is cleaned before it
 * is measured: composed (NFC), tabs and line breaks become a space, other
 * control and zero width characters are dropped, runs of spaces collapse.
 * Every check mirrors a constraint of `user_service_applicants` (0007) plus:
 *
 *   letters   every text field is in letters the documents can print. Accents
 *             are fine, including those the PDFs spell without them (see
 *             transliterate in src/lib/pdf/characters.ts); Cyrillic, Chinese
 *             or Arabic would print as question marks and are refused.
 *   dates     the principal is an adult (the deed says "maior de idade"), the
 *             passport was not issued in the future, expires after it was
 *             issued and has not expired, all by Lisbon's calendar.
 *
 * Messages are one short line each, US friendly, for the form to show as
 * they are. They name no document: the same details fill the powers of
 * attorney and the service agreement.
 */

export type ApplicantInput = Pick<
  UserServiceApplicantRow,
  | "full_name"
  | "gender"
  | "birth_place"
  | "birth_date"
  | "passport_number"
  | "passport_issuer"
  | "passport_issued_on"
  | "passport_expires_on"
  | "tax_address"
>;

export type ApplicantValidation =
  | { ok: true; value: ApplicantInput }
  | { ok: false; status: 422; message: string };

type TextColumn = Exclude<keyof ApplicantInput, "gender" | "birth_date" | "passport_issued_on" | "passport_expires_on">;
type DateColumn = "birth_date" | "passport_issued_on" | "passport_expires_on";

/** Body keys accepted for each column, first match wins. */
const KEYS: Record<keyof ApplicantInput, readonly string[]> = {
  full_name: ["fullName", "full_name"],
  gender: ["gender"],
  birth_place: ["birthPlace", "birth_place"],
  birth_date: ["birthDate", "birth_date"],
  passport_number: ["passportNumber", "passport_number"],
  passport_issuer: ["passportIssuer", "passport_issuer"],
  passport_issued_on: ["passportIssuedOn", "passportIssueDate", "passport_issued_on"],
  passport_expires_on: ["passportExpiresOn", "passportExpiryDate", "passport_expires_on"],
  tax_address: ["taxAddress", "tax_address"],
};

/** Lengths as in the SQL checks, counted in characters like Postgres does. */
const TEXT: Record<TextColumn, { min: number; max: number; missing: string }> = {
  full_name: { min: 2, max: 200, missing: "Enter your full name as it appears in your passport." },
  birth_place: { min: 2, max: 200, missing: "Enter your place of birth, city and country." },
  passport_number: { min: 3, max: 40, missing: "Enter your passport number." },
  passport_issuer: { min: 2, max: 200, missing: "Enter the authority that issued your passport." },
  tax_address: { min: 5, max: 400, missing: "Enter your full tax residence address." },
};

const DATE_INVALID: Record<DateColumn, string> = {
  birth_date: "Enter a valid date of birth.",
  passport_issued_on: "Enter a valid date of issue.",
  passport_expires_on: "Enter a valid expiry date.",
};

/** Shown for any text the documents could not print. Shared with the signing place of the agreement. */
export const LATIN_LETTERS_MESSAGE = "Use Latin letters, as in the machine readable line of your passport.";

const MESSAGES = {
  gender: "Choose She or He.",
  underage: "You need to be 18 or older.",
  issuedInFuture: "The date of issue cannot be in the future.",
  expiryBeforeIssue: "The expiry date must be after the date of issue.",
  expired: "Your passport has expired. Enter a valid passport.",
} as const;

const ADULT_AGE = 18;
/** Older than this is a typo, not a birth date a document should carry. */
const MIN_YEAR = 1900;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

type Ymd = { y: number; m: number; d: number };

/** `YYYY-MM-DD` as a real calendar date from 1900 on, else null. */
function parseIsoDate(value: string): Ymd | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (y < MIN_YEAR) return null;
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return { y, m, d };
}

function toIso({ y, m, d }: Ymd): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** The date `years` after `date`; 29 February rolls to 1 March in a common year, the way Date does. */
function addYears(date: Ymd, years: number): Ymd {
  const rolled = new Date(Date.UTC(date.y + years, date.m - 1, date.d));
  return { y: rolled.getUTCFullYear(), m: rolled.getUTCMonth() + 1, d: rolled.getUTCDate() };
}

/** Tab and line breaks: a space, so a pasted address keeps its word gaps. */
const BREAKS = /[\t\n\r]/g;
/** The other C0 controls, DEL, zero width characters and the byte order mark: nothing. */
const CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g;

/** What the form typed, with nothing in it a document could not carry: see the header. */
function clean(raw: string): string {
  return raw.normalize("NFC").replace(BREAKS, " ").replace(CONTROLS, "").replace(/ {2,}/g, " ").trim();
}

function read(body: Record<string, unknown>, column: keyof ApplicantInput): string {
  for (const key of KEYS[column]) {
    const raw = body[key];
    if (typeof raw === "string") return clean(raw);
  }
  return "";
}

function characters(value: string): number {
  return Array.from(value).length;
}

function fail(message: string): ApplicantValidation {
  return { ok: false, status: 422, message };
}

/**
 * Checks a request body and returns the columns to upsert, or the first
 * thing wrong with it. `today` is `YYYY-MM-DD` in Lisbon and is a parameter
 * only so tests can pin it.
 */
export function validateApplicantInput(body: unknown, today: string = lisbonIsoDate()): ApplicantValidation {
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail(TEXT.full_name.missing);
  const input = body as Record<string, unknown>;

  const text = (column: TextColumn): string | ApplicantValidation => {
    const value = read(input, column);
    const rule = TEXT[column];
    const length = characters(value);
    if (length < rule.min) return fail(rule.missing);
    if (length > rule.max) return fail(`Keep it under ${rule.max} characters.`);
    if (unprintable(value).length > 0) return fail(LATIN_LETTERS_MESSAGE);
    return value;
  };
  const date = (column: DateColumn): Ymd | ApplicantValidation => {
    const parsed = parseIsoDate(read(input, column));
    return parsed ?? fail(DATE_INVALID[column]);
  };

  const fullName = text("full_name");
  if (typeof fullName !== "string") return fullName;

  const gender = read(input, "gender");
  if (gender !== "f" && gender !== "m") return fail(MESSAGES.gender);

  const birthPlace = text("birth_place");
  if (typeof birthPlace !== "string") return birthPlace;

  const birthDate = date("birth_date");
  if (!("y" in birthDate)) return birthDate;
  if (toIso(addYears(birthDate, ADULT_AGE)) > today) return fail(MESSAGES.underage);

  const passportNumber = text("passport_number");
  if (typeof passportNumber !== "string") return passportNumber;

  const passportIssuer = text("passport_issuer");
  if (typeof passportIssuer !== "string") return passportIssuer;

  const issuedOn = date("passport_issued_on");
  if (!("y" in issuedOn)) return issuedOn;
  if (toIso(issuedOn) > today) return fail(MESSAGES.issuedInFuture);

  const expiresOn = date("passport_expires_on");
  if (!("y" in expiresOn)) return expiresOn;
  if (toIso(expiresOn) <= toIso(issuedOn)) return fail(MESSAGES.expiryBeforeIssue);
  if (toIso(expiresOn) < today) return fail(MESSAGES.expired);

  const taxAddress = text("tax_address");
  if (typeof taxAddress !== "string") return taxAddress;

  return {
    ok: true,
    value: {
      full_name: fullName,
      gender: gender as ApplicantGender,
      birth_place: birthPlace,
      birth_date: toIso(birthDate),
      passport_number: passportNumber,
      passport_issuer: passportIssuer,
      passport_issued_on: toIso(issuedOn),
      passport_expires_on: toIso(expiresOn),
      tax_address: taxAddress,
    },
  };
}
