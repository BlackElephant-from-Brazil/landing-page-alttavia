/**
 * The pure half of the operations alerts (./alerts.ts): which environment
 * an alert comes from, and how every value is cleaned before it reaches an
 * email or a log line. No imports, no I/O, so the tests and the
 * instrumentation hook can load it anywhere.
 *
 * What an alert may carry is decided here, once:
 *
 * - anything that looks like an email address becomes "[email]", also when
 *   it arrives URL encoded (`name%40example.com`);
 * - a query string after a path or URL becomes "?[query]", a JWT becomes
 *   "[token]", a Stripe or Resend style key becomes "[secret]";
 * - Postgres row dumps ("Failing row contains (...)", "Key (...)=(...)")
 *   are cut out to the end of their line, since a row of
 *   `user_service_applicants` holds a name and a passport number and a
 *   value may hold parentheses itself ("Lisbon (Portugal)"); only the fixed
 *   words Postgres writes after a key ("already exists.") are kept;
 * - every value is cut to 300 characters, and at most the first 5 frames
 *   of a stack are kept.
 *
 * Callers pass plain strings and never pass headers, cookies, bodies, query
 * strings, names or passport data in the first place; this is the net under
 * that rule, not a licence to pass them.
 */

export type OpsEnvironment = "production" | "staging" | "local";

/**
 * Where an alert comes from. OPS_ENVIRONMENT first ("production", "staging"
 * or "local", set by hand in each Netlify context), then Netlify's CONTEXT
 * (production, deploy-preview, branch-deploy or dev). Anything else is local.
 *
 * OPS_ENVIRONMENT comes first, as an override. Netlify documents CONTEXT as a
 * build variable: its functions get only URL, SITE_NAME and SITE_ID at run
 * time (docs.netlify.com, "Functions: environment variables", read on
 * 2026-09-28). So next.config.ts copies CONTEXT into the server code at build
 * time as NETLIFY_BUILD_CONTEXT, and that is the default read here when
 * CONTEXT itself is missing. OPS_ENVIRONMENT is then optional on Netlify.
 */
export function opsEnvironment(
  context: string | undefined = process.env.CONTEXT || process.env.NETLIFY_BUILD_CONTEXT,
  explicit: string | undefined = process.env.OPS_ENVIRONMENT,
): OpsEnvironment {
  const named = explicit?.trim().toLowerCase();
  if (named === "production" || named === "staging" || named === "local") return named;
  if (context === "production") return "production";
  if (context === "branch-deploy" || context === "deploy-preview") return "staging";
  return "local";
}

/** "[production]", "[staging]" or "[local]", the start of every alert subject. */
export function subjectPrefix(
  context: string | undefined = process.env.CONTEXT || process.env.NETLIFY_BUILD_CONTEXT,
  explicit: string | undefined = process.env.OPS_ENVIRONMENT,
): string {
  return `[${opsEnvironment(context, explicit)}]`;
}

export const MAX_VALUE_LENGTH = 300;
export const MAX_SUBJECT_LENGTH = 120;
export const MAX_STACK_LINES = 5;

const EMAIL = /[A-Za-z0-9._%+-]+(?:@|%40)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g;
const SECRET = /\b(?:sk|rk|pk|whsec|re)_(?:live_|test_)?[A-Za-z0-9]{8,}\b/g;
const QUERY = /(?<=[\w/.\]-])\?[^\s"'<>)]+/g;
/** A row dump always runs to the end of its line, so everything after the marker goes. */
const FAILING_ROW = /Failing row contains \(.*$/gim;
const KEY_DETAIL = /Key \(.*$/gim;
/** The fixed words Postgres writes after a key's values, kept so the alert still says what happened. */
const KEY_SUFFIX = /\)( already exists\.?| is not present in table "[\w.]*"\.?| is still referenced from table "[\w.]*"\.?)\s*$/;

/** Removes what must never reach an alert from one string. Pure. */
export function redact(value: string): string {
  return value
    .replace(FAILING_ROW, "Failing row contains [row].")
    .replace(KEY_DETAIL, (line) => `Key [values]${KEY_SUFFIX.exec(line)?.[1] ?? ""}`)
    .replace(JWT, "[token]")
    .replace(EMAIL, "[email]")
    .replace(SECRET, "[secret]")
    .replace(QUERY, "?[query]");
}

/** Cuts `value` to at most `max` characters, the last three being "..." when it was longer. */
export function cut(value: string, max: number = MAX_VALUE_LENGTH): string {
  if (value.length <= max) return value;
  if (max <= 3) return value.slice(0, max);
  return `${value.slice(0, max - 3)}...`;
}

/** One value as an alert may print it: redacted, whitespace folded to single spaces, cut. */
export function cleanText(value: unknown, max: number = MAX_VALUE_LENGTH): string {
  let text: string;
  try {
    text = typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
  } catch {
    text = "";
  }
  return cut(redact(text).replace(/\s+/g, " ").trim(), max);
}

/**
 * The first `max` frames of a stack ("at fn (file:line:col)"), each one
 * cleaned. The first lines of a stack repeat the message, which the alert
 * already carries, so only frame lines count. Empty when there is none.
 */
export function stackLines(stack: unknown, max: number = MAX_STACK_LINES): string[] {
  if (typeof stack !== "string" || stack.length === 0) return [];
  return stack
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at "))
    .slice(0, max)
    .map((line) => cleanText(line));
}

export type OpsFact = { label: string; value: string };

/** Facts as the email prints them: labels cut to 60, values cleaned, empty values shown as "Not given". */
export function cleanFacts(facts: readonly OpsFact[]): OpsFact[] {
  return facts.map((fact) => ({
    label: cleanText(fact.label, 60),
    value: cleanText(fact.value) || "Not given",
  }));
}

/** The path of a request without its query string or fragment, cleaned. */
export function pathWithoutQuery(path: unknown): string {
  const raw = typeof path === "string" ? path : "";
  const end = raw.search(/[?#]/);
  return cleanText(end === -1 ? raw : raw.slice(0, end));
}

const lisbonTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Europe/Lisbon",
});

/** "28 Sept 2026, 14:03:12", the time at the firm's desk. */
export function lisbonTimestamp(date: Date = new Date()): string {
  return lisbonTime.format(date);
}

/** An error's name, message, digest and stack, read without ever throwing. */
export function describeError(error: unknown): { name: string; message: string; digest: string; stack: string[] } {
  const read = (field: string): unknown => {
    try {
      return error !== null && typeof error === "object" ? (error as Record<string, unknown>)[field] : undefined;
    } catch {
      return undefined;
    }
  };
  const name = cleanText(read("name"), 80) || (typeof error === "string" ? "Thrown string" : "Error");
  const message = cleanText(typeof error === "string" ? error : read("message")) || "No message";
  const digest = cleanText(read("digest"), 80);
  return { name, message, digest, stack: stackLines(read("stack")) };
}
