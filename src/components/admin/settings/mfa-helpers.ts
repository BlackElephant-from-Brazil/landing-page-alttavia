/**
 * The pure part of the admin's second factor (a code from an authenticator
 * app, Supabase Auth TOTP): the copy, the error lines, and the small
 * transforms the set up screen and the login form share. No React, no
 * Supabase client, so the tests run it as is.
 *
 * Copy follows the house rules of src/content/bank-nif.ts: short
 * sentences, second person, no dashes as punctuation.
 */

export const CODE_LENGTH = 6;

/**
 * The name the authenticator app shows above the codes, next to the
 * account's email. Sent as `issuer` on enrolment; without it Supabase uses
 * the host of the project's site URL, which reads "localhost:3000" on a
 * phone when the site URL is not set yet.
 */
export const TOTP_ISSUER = "Alttavia Admin";

/**
 * The factor's name in Supabase. Only the firm's side sees it (the app
 * shows the issuer and the email). Supabase refuses two factors with the
 * same name, so the set up time goes in.
 */
export function factorName(now: Date = new Date()): string {
  return `Authenticator app ${now.toISOString().slice(0, 16).replace("T", " ")}`;
}

export const mfaCopy = {
  heading: "Second factor",
  offLead:
    "Add a code from an authenticator app on your phone to every sign in. With it, a password alone no longer opens the admin area.",
  appHint: "Any authenticator app works: Google Authenticator, Microsoft Authenticator, 1Password or Authy.",
  setUp: "Set up",
  starting: "Starting",
  scanStep: "Open the authenticator app, add an account and scan this code.",
  qrAlt: "QR code to add the Alttavia admin to your authenticator app",
  manualStep: "Cannot scan it? Type this key into the app instead:",
  codeStep: "Then enter the 6 digit code the app shows.",
  codeLabel: "6 digit code",
  codePlaceholder: "000000",
  turnOn: "Turn on",
  checking: "Checking",
  cancel: "Cancel",
  onSince: (date: string) => `On since ${date}.`,
  onLead: "Every sign in asks for your password and then for the code from your app.",
  turnOff: "Turn off",
  turnOffLead: "Enter the code your app shows now to turn the second factor off.",
  turningOff: "Turning off",
  enabled: "The second factor is on. From now on every sign in asks for the code from your app.",
  otherDevices: "Other devices where you were signed in need to sign in again.",
  disabled: "The second factor is off. Sign ins ask for your password only.",
  required: {
    heading: "Set up your second factor",
    lead: "The admin area now asks for a code from an authenticator app at every sign in. Set it up once to continue. It takes a minute.",
  },
  loadFailed: "We could not check this right now. Refresh the page to try again.",
} as const;

export const mfaErrors = {
  codeShort: "Enter the 6 digits from the app.",
  codeWrong: "That code is not right. Check the app and try again.",
  expired: "That took a little too long. Enter the code the app shows now.",
  rateLimited: "Too many attempts. Wait a few minutes and try again.",
  notEnabled: "The second factor is not switched on for the platform yet. Try again later.",
  signIn: "Your session has ended. Sign in again.",
  generic: "Something went wrong on our side.",
} as const;

type AuthErrorLike = { code?: string; status?: number } | null | undefined;

/**
 * The one line to show for an error Supabase Auth answered on an MFA call.
 * Nothing Supabase writes reaches the screen.
 */
export function mfaErrorLine(error: AuthErrorLike): string {
  if (!error) return mfaErrors.generic;
  const { code, status } = error;
  if (status === 429 || code === "over_request_rate_limit") return mfaErrors.rateLimited;
  if (code === "mfa_totp_enroll_not_enabled" || code === "mfa_totp_verify_not_enabled") return mfaErrors.notEnabled;
  if (code === "mfa_challenge_expired") return mfaErrors.expired;
  if (code === "mfa_verification_failed" || code === "mfa_verification_rejected" || code === "invalid_credentials") {
    return mfaErrors.codeWrong;
  }
  if (code === "session_not_found" || code === "session_expired" || code === "refresh_token_not_found" || status === 401) {
    return mfaErrors.signIn;
  }
  if (code === "bad_jwt" || code === "no_authorization") return mfaErrors.signIn;
  // Any other 4xx on a verify is most likely the code itself.
  if (status !== undefined && status >= 400 && status < 500 && code === undefined) return mfaErrors.codeWrong;
  return mfaErrors.generic;
}

/** Digits only, at most six: what the code field keeps of what was typed or pasted. */
export function cleanCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

/** The secret in groups of four, easier to type into an app by hand. */
export function groupSecret(secret: string): string {
  return (secret.replace(/\s/g, "").match(/.{1,4}/g) ?? []).join(" ");
}

const SVG_DATA_PREFIX = /^data:image\/svg\+xml;(?:utf-?8|charset=utf-?8)?,/i;

/**
 * An `<img src>` for the QR code Supabase returns. supabase-js hands it
 * back as `data:image/svg+xml;utf-8,<svg ...>` with the markup unescaped,
 * and a `#` in it (a colour) would end the URL early in some browsers, so
 * the markup is percent encoded again. Anything that is not an SVG answers
 * null and the screen falls back to the key typed by hand.
 */
export function qrImageSrc(qrCode: unknown): string | null {
  if (typeof qrCode !== "string") return null;
  const markup = qrCode.replace(SVG_DATA_PREFIX, "").trim();
  if (!/^(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(markup)) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

type FactorLike = { id?: unknown; factor_type?: unknown; status?: unknown; created_at?: unknown };

export type EnrolledFactor = { id: string; createdAt: string };

/**
 * The account's verified TOTP factors, oldest first, reduced to what the
 * screens need. Anything malformed is left out.
 */
export function verifiedTotpFactors(factors: unknown): EnrolledFactor[] {
  if (!Array.isArray(factors)) return [];
  return factors
    .filter(
      (factor): factor is FactorLike =>
        typeof factor === "object" &&
        factor !== null &&
        (factor as FactorLike).factor_type === "totp" &&
        (factor as FactorLike).status === "verified" &&
        typeof (factor as FactorLike).id === "string",
    )
    .map((factor) => ({ id: factor.id as string, createdAt: typeof factor.created_at === "string" ? factor.created_at : "" }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** The ids of TOTP factors left unverified by a set up that was not finished. */
export function unverifiedTotpIds(factors: unknown): string[] {
  if (!Array.isArray(factors)) return [];
  return factors
    .filter(
      (factor): factor is FactorLike =>
        typeof factor === "object" &&
        factor !== null &&
        (factor as FactorLike).factor_type === "totp" &&
        (factor as FactorLike).status === "unverified" &&
        typeof (factor as FactorLike).id === "string",
    )
    .map((factor) => factor.id as string);
}

/**
 * What the login form does after a correct password, from
 * `getAuthenticatorAssuranceLevel()`:
 *
 *   "code"      the account has a factor and this session is at aal1: ask for it
 *   "enrol"     every admin must have one (ADMIN_REQUIRE_MFA=1) and this one has none
 *   "continue"  on to the admin area
 */
export function nextLoginStep(
  levels: { currentLevel: string | null; nextLevel: string | null } | null,
  requireForAll: boolean,
): "code" | "enrol" | "continue" {
  if (!levels) return "continue";
  if (levels.nextLevel === "aal2" && levels.currentLevel !== "aal2") return "code";
  if (requireForAll && levels.currentLevel !== "aal2") return "enrol";
  return "continue";
}
