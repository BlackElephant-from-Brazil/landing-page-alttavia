import { isCountryCode } from "./countries";
import { VISA_OPTIONS } from "./steps";
import { isProductId, type Answers } from "./types";

/**
 * Answers survive a refresh through sessionStorage. The branch deploys on
 * every push, so whatever is stored may have been written by an older build:
 * everything is re-validated field by field and anything odd is dropped.
 */
export const STORAGE_KEY = "alttavia_apply_v1";

export function sanitizeAnswers(raw: unknown): Answers {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const a: Answers = {};

  if (isCountryCode(r.residence)) a.residence = r.residence.toUpperCase();
  if (r.applicants === "one" || r.applicants === "two" || r.applicants === "more") a.applicants = r.applicants;
  if (typeof r.childrenNifs === "boolean") a.childrenNifs = r.childrenNifs;
  if (Array.isArray(r.hasNif)) {
    a.hasNif = r.hasNif.slice(0, 2).map((v) => (typeof v === "boolean" ? v : undefined));
  }
  if (r.bank === "yes" || r.bank === "joint" || r.bank === "separate" || r.bank === "none") a.bank = r.bank;
  if (Array.isArray(r.passport)) {
    a.passport = r.passport.slice(0, 2).map((v) => (isCountryCode(v) ? v.toUpperCase() : undefined));
  }
  if (typeof r.visa === "string" && (VISA_OPTIONS as readonly string[]).includes(r.visa)) {
    a.visa = r.visa as Answers["visa"];
  }
  if (isProductId(r.preselected)) a.preselected = r.preselected;
  return a;
}

export function loadAnswers(): Answers {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeAnswers(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function saveAnswers(a: Answers): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(a));
  } catch {
    // Private mode or a full store: the wizard still works, it just forgets on refresh.
  }
}

export function clearAnswers(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Same as above.
  }
}
