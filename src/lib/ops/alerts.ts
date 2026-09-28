import "server-only";

import { dashboardUrl, opsAlert } from "@/lib/email/templates";

import {
  cleanFacts,
  cleanText,
  lisbonTimestamp,
  MAX_SUBJECT_LENGTH,
  opsEnvironment,
  stackLines,
  subjectPrefix,
  type OpsFact,
} from "./format";
import {
  budgetedStore,
  decideWithStore,
  KEY_WINDOW_MS,
  MemoryThrottle,
  releaseClaim,
  STORE_BUDGET_MS,
  supabaseThrottleStore,
  throttleKey,
  type ThrottleDecision,
  type ThrottleStore,
} from "./throttle";

/**
 * Email alerts for what would otherwise only reach Netlify's logs: a server
 * error in a page or a route handler (src/instrumentation.ts, through
 * ./request-error.ts) and a Stripe webhook that was refused or could not
 * record a payment (src/app/api/stripe/webhook/route.ts). Approved by the
 * owner on 2026-09-28; an uptime monitor is not part of it.
 *
 *   sendOpsAlert({ kind, key, subject, facts, stack?, link?, windowMs?, failOpen? }) -> OpsAlertOutcome
 *
 * Rules, in the order they apply:
 *
 * 1. Outside a production build (NODE_ENV not "production": next dev, the
 *    tests) the alert is one console.info line and nothing else.
 * 2. It goes to ALERTS_TO, else FEEDBACK_TO. Neither set: one console.warn.
 * 3. The subject starts with "[production]", "[staging]" or "[local]" from
 *    OPS_ENVIRONMENT, else Netlify's CONTEXT (./format.ts). Staging is a
 *    production build too, so it alerts, marked as staging.
 * 4. One email per key every 30 minutes (or the caller's `windowMs`), 20 per
 *    rolling hour and 30 per rolling day in all, per environment, shared by
 *    every serverless instance through `public.ops_alerts` (./throttle.ts,
 *    migration 0019). The next email for a key says how many were held. A
 *    repeat this instance already knows to be held skips the database.
 *    Every database call of one decision shares a 2.5 second budget.
 * 5. When that table cannot be read (the alert may be about the database
 *    itself, or 0019 is not applied yet), an alert with `failOpen` (the
 *    default: server errors, a payment that could not be recorded) is
 *    decided by the same rules in this instance's memory and sent. An alert
 *    a stranger can set off (`failOpen: false`: the webhook's signature and
 *    secret refusals) is logged only, because every new serverless instance
 *    starts with an empty memory and a burst of requests would otherwise
 *    send one email per instance.
 * 6. An email Resend refuses gives its claim back (./throttle.ts,
 *    `releaseClaim`): the key may try again five minutes later and the
 *    occurrence is counted for the next email.
 * 7. Every value is cleaned by ./format.ts: email addresses become
 *    "[email]", query strings and tokens go, each value is cut to 300
 *    characters, at most 5 stack frames. Callers pass plain strings and
 *    never headers, cookies, bodies, query strings, names or passport data.
 *
 * It never throws, and it resolves within five seconds whatever the
 * database or Resend do (the work may finish later in the background). The
 * webhook calls it inside after(), so its answer to Stripe never waits.
 * The Resend sender and the admin client are imported lazily, so a module
 * that imports this one does not pull them into its graph until an alert
 * is actually due.
 *
 * No recursion: nothing here goes through a Next.js request handler, so an
 * alert cannot raise another request error, and a failure while alerting is
 * logged only. At most 10 alerts run at once per instance; beyond that an
 * alert is logged and dropped.
 */

export type OpsAlertKind = "server_error" | "webhook";

export type OpsAlertInput = {
  kind: OpsAlertKind;
  /** What is throttled together, such as "route:/api/checkout" or "record_failed:<order id>". */
  key: string;
  /** Short and plain; the environment prefix is added here. */
  subject: string;
  /** Plain strings, cleaned here. */
  facts: OpsFact[];
  /** A raw error stack; only its first 5 frames are kept, cleaned. */
  stack?: string;
  /** An admin screen that helps, such as the order a failed payment names. */
  link?: { label: string; path: string };
  /** How long repeats of this key are held. Default 30 minutes. */
  windowMs?: number;
  /**
   * Whether the alert is still sent when the shared throttle cannot be read.
   * Default true. Pass false for anything a stranger can set off.
   */
  failOpen?: boolean;
};

export type OpsAlertOutcome =
  | "sent"
  | "logged"
  | "no_recipient"
  | "throttled"
  | "capped"
  | "store_unavailable"
  | "send_failed"
  | "failed"
  | "timed_out"
  | "busy";

export type OpsAlertOptions = {
  /** The throttle store; null forces the fallback. Default: `public.ops_alerts` through the admin client. */
  store?: ThrottleStore | null;
  /** The per instance memory. Default: one shared by the whole module. */
  memory?: MemoryThrottle;
  now?: number;
  /** How long a caller waits at most. Default 5 seconds. */
  deadlineMs?: number;
  /** The time all database calls of one decision share. Default 2.5 seconds. */
  storeBudgetMs?: number;
};

export const ALERT_DEADLINE_MS = 5000;
const MAX_IN_FLIGHT = 10;
/** The time the database gets to take back a claim whose email failed. */
const RELEASE_BUDGET_MS = 1500;

/** An admin path the button may point at: /admin, then plain segments and a plain query. */
const ADMIN_PATH = /^\/admin(?:\/[A-Za-z0-9_\-/]*)?(?:\?[A-Za-z0-9_=&-]*)?$/;

const sharedMemory = new MemoryThrottle();
let inFlight = 0;

function reason(error: unknown): string {
  try {
    return cleanText(error instanceof Error ? error.message : error) || "no message";
  } catch {
    return "no message";
  }
}

/** "30 minutes", "6 hours": how the email's footnote names a window. */
export function holdLabel(windowMs: number): string {
  const hours = windowMs / 3_600_000;
  if (Number.isInteger(hours) && hours >= 1) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const minutes = Math.max(1, Math.round(windowMs / 60_000));
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

async function defaultStore(): Promise<ThrottleStore> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return supabaseThrottleStore(createAdminClient());
}

type Decided = { decision: ThrottleDecision; giveBack: () => Promise<void> };

const nothingToGiveBack = async () => {};

/**
 * The throttle's answer for one alert, and how to give its claim back if the
 * email then fails. "store_unavailable" when the table cannot be read and
 * the alert may not fall back to memory.
 */
async function decide(
  key: string,
  environment: string,
  now: number,
  windowMs: number,
  failOpen: boolean,
  options: OpsAlertOptions,
): Promise<Decided | "store_unavailable"> {
  const memory = options.memory ?? sharedMemory;
  if (memory.holds(key, now, windowMs)) {
    return { decision: { send: false, reason: "throttled" }, giveBack: nothingToGiveBack };
  }

  let base: ThrottleStore | null;
  let decision: ThrottleDecision;
  try {
    base = options.store === undefined ? await defaultStore() : options.store;
    if (!base) throw new Error("no throttle store");
    decision = await decideWithStore(budgetedStore(base, options.storeBudgetMs ?? STORE_BUDGET_MS), key, environment, now, windowMs);
  } catch (error) {
    if (!failOpen) {
      console.warn(`ops alert: throttle table unavailable, this alert is logged only: ${reason(error)}`);
      return "store_unavailable";
    }
    console.warn(`ops alert: throttle table unavailable, this instance decides alone: ${reason(error)}`);
    const fallback = memory.decide(key, now, windowMs);
    const moreSince = fallback.send ? fallback.moreSince : 0;
    return {
      decision: fallback,
      giveBack: async () => memory.giveBack(key, now, windowMs, moreSince + 1),
    };
  }

  if (!decision.send) {
    memory.note(key, decision.sentAt ?? now, false);
    return { decision, giveBack: nothingToGiveBack };
  }

  const heldHere = memory.takeHeld(key);
  memory.note(key, now, true);
  const claim = decision.claim ? { ...decision.claim, moreSince: decision.claim.moreSince + heldHere } : undefined;
  const store = base;
  return {
    decision: { send: true, moreSince: decision.moreSince + heldHere, claim },
    giveBack: async () => {
      memory.giveBack(key, now, windowMs, 0);
      if (claim) await releaseClaim(budgetedStore(store, RELEASE_BUDGET_MS), claim);
    },
  };
}

async function deliver(input: OpsAlertInput, options: OpsAlertOptions): Promise<OpsAlertOutcome> {
  const now = options.now ?? Date.now();
  const environment = opsEnvironment();
  const prefix = subjectPrefix();
  const subject = cleanText(input.subject, MAX_SUBJECT_LENGTH) || "Alert";
  const facts = cleanFacts([
    ...(Array.isArray(input.facts) ? input.facts : []),
    { label: "Environment", value: environment },
    { label: "Time in Lisbon", value: lisbonTimestamp(new Date(now)) },
  ]);
  const stack = stackLines(input.stack);
  const windowMs =
    typeof input.windowMs === "number" && Number.isFinite(input.windowMs) && input.windowMs > 0 ? input.windowMs : KEY_WINDOW_MS;
  const failOpen = input.failOpen !== false;

  if (process.env.NODE_ENV !== "production") {
    console.info(
      `ops alert, not emailed outside a production build: ${prefix} ${subject} | ${facts
        .map((fact) => `${fact.label}: ${fact.value}`)
        .join(" | ")}`,
    );
    return "logged";
  }

  const to = process.env.ALERTS_TO?.trim() || process.env.FEEDBACK_TO?.trim();
  if (!to) {
    console.warn(`ops alert: ALERTS_TO and FEEDBACK_TO are not set; "${prefix} ${subject}" not emailed`);
    return "no_recipient";
  }

  const key = throttleKey(environment, input.kind, cleanText(input.key, 150) || "unknown");
  const decided = await decide(key, environment, now, windowMs, failOpen, options);
  if (decided === "store_unavailable") {
    console.info(`ops alert, not emailed without the shared throttle: ${prefix} ${subject}`);
    return "store_unavailable";
  }
  const { decision } = decided;
  if (!decision.send) {
    console.info(`ops alert: "${prefix} ${subject}" held (${decision.reason})`);
    return decision.reason;
  }

  const link =
    input.link && ADMIN_PATH.test(input.link.path)
      ? { label: cleanText(input.link.label, 60) || "Open", url: dashboardUrl(null, input.link.path) }
      : undefined;

  const content = opsAlert({
    prefix,
    kind: input.kind,
    subject,
    facts,
    stack,
    moreSince: decision.moreSince,
    link,
    heldFor: holdLabel(windowMs),
  });

  const { sendEmail } = await import("@/lib/email/send");
  let result: { ok: boolean };
  try {
    result = await sendEmail({ to, ...content });
  } catch (error) {
    await decided.giveBack();
    throw error;
  }
  if (result.ok) return "sent";
  await decided.giveBack();
  return "send_failed";
}

function withDeadline(work: Promise<OpsAlertOutcome>, ms: number): Promise<OpsAlertOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<OpsAlertOutcome>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`ops alert: still running after ${ms} ms; the caller goes on without it`);
      resolve("timed_out");
    }, ms);
    (timer as { unref?: () => void }).unref?.();
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}

/** Sends one operations alert, best effort. Never throws; resolves within `deadlineMs`. */
export async function sendOpsAlert(input: OpsAlertInput, options: OpsAlertOptions = {}): Promise<OpsAlertOutcome> {
  try {
    if (inFlight >= MAX_IN_FLIGHT) {
      console.warn(`ops alert: ${inFlight} alerts already running; "${cleanText(input?.subject, 80)}" dropped`);
      return "busy";
    }
    inFlight += 1;
    const work = deliver(input, options)
      .catch((error: unknown): OpsAlertOutcome => {
        console.error(`ops alert: failed: ${reason(error)}`);
        return "failed";
      })
      .finally(() => {
        inFlight -= 1;
      });
    return await withDeadline(work, options.deadlineMs ?? ALERT_DEADLINE_MS);
  } catch (error) {
    try {
      console.error(`ops alert: failed: ${reason(error)}`);
    } catch {
      // Even the log line failed; the caller carries on regardless.
    }
    return "failed";
  }
}
