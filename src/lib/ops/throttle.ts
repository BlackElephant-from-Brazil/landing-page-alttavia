import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Whether an operations alert may go out now: at most one email per key
 * every 30 minutes (or the longer window a caller gives a key), at most 20
 * alert emails per rolling hour and at most 30 per rolling day in all, per
 * environment. The day cap keeps the alerts well under the Resend plan's
 * daily quota, which the sign in codes and the client emails share.
 *
 * Netlify runs the site as many short lived instances, so the memory of
 * one instance cannot throttle anything. The rows live in
 * `public.ops_alerts` (supabase/migrations/0019_ops_alerts.sql), and every
 * claim is one conditional write that only one instance can win:
 *
 * - a key seen for the first time is claimed by an insert; a second
 *   instance inserting the same key gets a unique violation and loses;
 * - a key whose window has passed is claimed by an update that only
 *   matches while `last_sent_at` is still older than the window, so of two
 *   updates the second finds nothing to change (Postgres re-reads the row
 *   after the first one commits);
 * - the caps are slot rows, 20 for the hour (`cap:<environment>:00` to
 *   `:19`) and 30 for the day (`day:<environment>:00` to `:29`), each
 *   claimed the same way with its own window. Twenty slots that can each be
 *   taken once an hour allow at most twenty emails in any hour.
 *
 * The loser of a claim, and every occurrence inside the window, adds one to
 * the key's `suppressed` (best effort, an optimistic update that may lose a
 * count under a race). The next email for that key says how many there
 * were and resets it. When the key wins but a cap is full, the key keeps
 * its new `last_sent_at` and its count grows by one, so nothing is lost but
 * the timing.
 *
 * An email that does not go out after all (Resend refused it) gives its
 * claim back with `releaseClaim`: the cap slots return at once, the key
 * reopens five minutes later (so a Resend outage costs one try per key
 * every five minutes, not one per occurrence), and the occurrence is
 * counted for the next email.
 *
 * Keys carry the environment (production, staging, local) because staging
 * and production share one database: a staging flood must not silence
 * production for half an hour, nor use up its caps.
 *
 * `decideWithStore` throws when the store does; the caller (./alerts.ts)
 * then falls back to `MemoryThrottle`, the same rules for one instance, or
 * only logs the alert when a stranger could have set it off. Wrap the store
 * in `budgetedStore` so a slow database gives up as a whole, not call by
 * call.
 */

export const KEY_WINDOW_MS = 30 * 60 * 1000;
export const CAP_WINDOW_MS = 60 * 60 * 1000;
export const CAP_PER_WINDOW = 20;
export const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const DAY_CAP = 30;
export const MAX_KEY_LENGTH = 200;
/** How soon a key whose email failed may try again. */
export const RETRY_AFTER_MS = 5 * 60 * 1000;
/** The time every database call of one decision shares. */
export const STORE_BUDGET_MS = 2500;

/** How many cap slots one alert tries before it counts the cap as full. */
const CAP_ATTEMPTS = 4;
/** What a given back slot reads: long ago, so the next claim takes it. */
const EPOCH = new Date(0).toISOString();

export type ThrottleRow = { key: string; last_sent_at: string; suppressed: number };

/** What the throttle needs from the database. Every method throws on a failure it cannot read as an answer. */
export interface ThrottleStore {
  /** The rows among `keys` that exist. */
  read(keys: string[]): Promise<ThrottleRow[]>;
  /** Inserts a new row. False when the key exists already: another instance won. */
  insert(row: ThrottleRow): Promise<boolean>;
  /** Writes `next` only while the row's `last_sent_at` is at or before `cutoff`. True when this call changed it. */
  claim(key: string, cutoff: string, next: { last_sent_at: string; suppressed: number }): Promise<boolean>;
  /** Sets `suppressed` to `to` only while it still reads `from`. True when this call changed it. */
  setSuppressed(key: string, from: number, to: number): Promise<boolean>;
  /** Moves `last_sent_at` to `to` only while it still reads `sentAt`: a claim given back. True when this call changed it. */
  release(key: string, sentAt: string, to: string): Promise<boolean>;
}

/** What one winning decision took, so it can be given back when the email does not go out. */
export type ThrottleClaim = {
  key: string;
  /** The cap slots taken, the hour's and the day's. */
  slots: string[];
  /** When, as written in `last_sent_at`. */
  sentAt: string;
  windowMs: number;
  moreSince: number;
};

export type ThrottleDecision =
  | { send: true; moreSince: number; claim?: ThrottleClaim }
  | {
      send: false;
      reason: "throttled" | "capped";
      /** When the email that holds this key's window was claimed, when the database said. */
      sentAt?: number;
    };

/** The row key for one alert: environment, kind and the caller's key, cut to a bounded length. */
export function throttleKey(environment: string, kind: string, key: string): string {
  return `${environment}:${kind}:${key}`.slice(0, MAX_KEY_LENGTH);
}

/** The 20 slot keys of one environment's hourly cap. */
export function capKeys(environment: string): string[] {
  return Array.from({ length: CAP_PER_WINDOW }, (_, i) => `cap:${environment}:${String(i).padStart(2, "0")}`);
}

/** The 30 slot keys of one environment's daily cap. */
export function dayCapKeys(environment: string): string[] {
  return Array.from({ length: DAY_CAP }, (_, i) => `day:${environment}:${String(i).padStart(2, "0")}`);
}

function isoAt(ms: number): string {
  return new Date(ms).toISOString();
}

function sentAt(row: ThrottleRow): number {
  const ms = Date.parse(row.last_sent_at);
  return Number.isNaN(ms) ? 0 : ms;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Adds `amount` held occurrences to `key`, best effort: one retry on a lost race, and never a throw. */
async function addSuppressed(store: ThrottleStore, key: string, amount: number, known?: number): Promise<void> {
  try {
    let from = known;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (from === undefined) {
        const [row] = await store.read([key]);
        if (!row) return;
        from = row.suppressed;
      }
      if (await store.setSuppressed(key, from, from + amount)) return;
      from = undefined;
    }
  } catch (error) {
    console.warn(`ops alert: could not count a held alert for ${key}: ${message(error)}`);
  }
}

/** Gives one slot or key back, best effort. */
async function giveBack(store: ThrottleStore, key: string, sentAtIso: string, to: string): Promise<void> {
  try {
    await store.release(key, sentAtIso, to);
  } catch (error) {
    console.warn(`ops alert: could not give back ${key}: ${message(error)}`);
  }
}

/** Takes one of `keys` whose last use is older than `windowMs`. The key taken, or null when every one is in use. */
async function claimSlot(store: ThrottleStore, keys: string[], windowMs: number, now: number): Promise<string | null> {
  const rows = new Map((await store.read(keys)).map((row) => [row.key, row]));
  const cutoff = now - windowMs;
  const missing = keys.filter((key) => !rows.has(key));
  const expired = [...rows.values()].filter((row) => sentAt(row) <= cutoff).sort((a, b) => sentAt(a) - sentAt(b));
  const candidates = [...missing.map((key) => ({ key, insert: true })), ...expired.map((row) => ({ key: row.key, insert: false }))];

  for (const candidate of candidates.slice(0, CAP_ATTEMPTS)) {
    const won = candidate.insert
      ? await store.insert({ key: candidate.key, last_sent_at: isoAt(now), suppressed: 0 })
      : await store.claim(candidate.key, isoAt(cutoff), { last_sent_at: isoAt(now), suppressed: 0 });
    if (won) return candidate.key;
  }
  return null;
}

/**
 * The shared decision for one alert. `key` is already a `throttleKey`;
 * `windowMs` is how long repeats of it are held. Throws when the store fails
 * before a decision is reached.
 */
export async function decideWithStore(
  store: ThrottleStore,
  key: string,
  environment: string,
  now: number = Date.now(),
  windowMs: number = KEY_WINDOW_MS,
): Promise<ThrottleDecision> {
  const [row] = await store.read([key]);
  let moreSince = 0;

  if (!row) {
    const won = await store.insert({ key, last_sent_at: isoAt(now), suppressed: 0 });
    if (!won) {
      await addSuppressed(store, key, 1);
      return { send: false, reason: "throttled", sentAt: now };
    }
  } else if (sentAt(row) > now - windowMs) {
    await addSuppressed(store, key, 1, row.suppressed);
    return { send: false, reason: "throttled", sentAt: sentAt(row) };
  } else {
    const won = await store.claim(key, isoAt(now - windowMs), { last_sent_at: isoAt(now), suppressed: 0 });
    if (!won) {
      await addSuppressed(store, key, 1);
      return { send: false, reason: "throttled", sentAt: now };
    }
    moreSince = Math.max(0, row.suppressed);
  }

  const hour = await claimSlot(store, capKeys(environment), CAP_WINDOW_MS, now);
  const day = hour ? await claimSlot(store, dayCapKeys(environment), DAY_WINDOW_MS, now) : null;
  if (!hour || !day) {
    // An hour slot taken for an email that will not go out is given back.
    if (hour) await giveBack(store, hour, isoAt(now), EPOCH);
    // The key's window is taken without an email: carry this occurrence and
    // the ones it would have reported into the next one.
    await addSuppressed(store, key, moreSince + 1, 0);
    return { send: false, reason: "capped", sentAt: now };
  }

  return { send: true, moreSince, claim: { key, slots: [hour, day], sentAt: isoAt(now), windowMs, moreSince } };
}

/**
 * Gives back what a winning decision took when its email did not go out:
 * the cap slots at once, the key's window after RETRY_AFTER_MS, and the
 * occurrence (with the ones the email would have reported) counted for the
 * next email. Best effort, never throws.
 */
export async function releaseClaim(store: ThrottleStore, claim: ThrottleClaim): Promise<void> {
  const claimedAt = Date.parse(claim.sentAt);
  const reopen = isoAt((Number.isNaN(claimedAt) ? 0 : claimedAt) - claim.windowMs + RETRY_AFTER_MS);
  await giveBack(store, claim.key, claim.sentAt, reopen);
  for (const slot of claim.slots) await giveBack(store, slot, claim.sentAt, EPOCH);
  await addSuppressed(store, claim.key, claim.moreSince + 1);
}

/**
 * The store with one time budget for all its calls: once `budgetMs` has
 * passed since this was built, every call (a pending one included) throws.
 * A database that is slow on every call then fails as a whole, early
 * enough for the fallback and the email to fit in the alert's deadline.
 */
export function budgetedStore(store: ThrottleStore, budgetMs: number = STORE_BUDGET_MS): ThrottleStore {
  const deadline = Date.now() + budgetMs;
  const run = <T>(what: string, call: () => Promise<T>): Promise<T> => {
    const left = deadline - Date.now();
    if (left <= 0) return Promise.reject(new Error(`ops_alerts ${what}: over the ${budgetMs} ms budget`));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`ops_alerts ${what}: over the ${budgetMs} ms budget`)), left);
      (timer as { unref?: () => void }).unref?.();
    });
    return Promise.race([call(), timeout]).finally(() => clearTimeout(timer));
  };
  return {
    read: (keys) => run("read", () => store.read(keys)),
    insert: (row) => run("insert", () => store.insert(row)),
    claim: (key, cutoff, next) => run("claim", () => store.claim(key, cutoff, next)),
    setSuppressed: (key, from, to) => run("count", () => store.setSuppressed(key, from, to)),
    release: (key, at, to) => run("release", () => store.release(key, at, to)),
  };
}

/**
 * The same rules held in one instance's memory, for when the database cannot
 * be reached. Per instance only: two instances may each send once.
 *
 * It also remembers what the database decided in this instance (`note`),
 * so ./alerts.ts can hold a repeat without a database round trip while
 * this instance knows the key's window is taken (`holds`). Those repeats
 * are counted here and added to this instance's next email for the key
 * (`takeHeld`); a repeat that another instance reports is not.
 */
export class MemoryThrottle {
  private readonly keys = new Map<string, { lastSentAt: number; suppressed: number }>();
  private sends: number[] = [];

  decide(key: string, now: number = Date.now(), windowMs: number = KEY_WINDOW_MS): ThrottleDecision {
    const entry = this.keys.get(key);
    if (entry && entry.lastSentAt > now - windowMs) {
      entry.suppressed += 1;
      return { send: false, reason: "throttled" };
    }

    this.sends = this.sends.filter((at) => at > now - DAY_WINDOW_MS);
    const moreSince = entry?.suppressed ?? 0;
    const lastHour = this.sends.filter((at) => at > now - CAP_WINDOW_MS).length;
    if (lastHour >= CAP_PER_WINDOW || this.sends.length >= DAY_CAP) {
      this.keys.set(key, { lastSentAt: now, suppressed: moreSince + 1 });
      return { send: false, reason: "capped" };
    }

    this.sends.push(now);
    if (this.keys.size >= 500) this.prune(now);
    this.keys.set(key, { lastSentAt: now, suppressed: 0 });
    return { send: true, moreSince };
  }

  /** True, and the repeat counted, when this instance knows the key's window is still taken. */
  holds(key: string, now: number = Date.now(), windowMs: number = KEY_WINDOW_MS): boolean {
    const entry = this.keys.get(key);
    if (!entry || entry.lastSentAt <= now - windowMs) return false;
    entry.suppressed += 1;
    return true;
  }

  /** Records a decision the database made: the key's window started at `at`, and this instance sent when `sent`. */
  note(key: string, at: number, sent: boolean): void {
    const entry = this.keys.get(key);
    if (!entry) {
      if (this.keys.size >= 500) this.prune(at);
      this.keys.set(key, { lastSentAt: at, suppressed: 0 });
    } else if (at > entry.lastSentAt) {
      entry.lastSentAt = at;
    }
    if (sent) this.sends.push(at);
  }

  /** The repeats this instance held for `key` since its last email, now handed to the next one. */
  takeHeld(key: string): number {
    const entry = this.keys.get(key);
    if (!entry) return 0;
    const held = entry.suppressed;
    entry.suppressed = 0;
    return held;
  }

  /** A send decided at `at` that did not go out: the key reopens after RETRY_AFTER_MS and `restore` repeats are counted again. */
  giveBack(key: string, at: number, windowMs: number, restore: number): void {
    const entry = this.keys.get(key);
    if (entry) {
      entry.lastSentAt = at - windowMs + RETRY_AFTER_MS;
      entry.suppressed += restore;
    }
    const index = this.sends.lastIndexOf(at);
    if (index !== -1) this.sends.splice(index, 1);
  }

  private prune(now: number): void {
    for (const [key, entry] of this.keys) {
      if (entry.lastSentAt <= now - DAY_WINDOW_MS && entry.suppressed === 0) this.keys.delete(key);
    }
    if (this.keys.size >= 500) this.keys.clear();
  }
}

type PostgrestError = { code?: string; message: string } | null;

/**
 * The store on `public.ops_alerts` through the admin client. Each call gives
 * up after `timeoutMs`, so a paused or unreachable database turns into a
 * throw (and the fallback) quickly.
 */
export function supabaseThrottleStore(db: SupabaseClient, timeoutMs: number = 2000): ThrottleStore {
  const table = () => db.from("ops_alerts");
  const signal = () => AbortSignal.timeout(timeoutMs);
  const fail = (what: string, error: NonNullable<PostgrestError>): never => {
    throw new Error(`ops_alerts ${what}: ${error.code ? `${error.code} ` : ""}${error.message}`);
  };

  return {
    async read(keys) {
      const { data, error } = await table().select("key, last_sent_at, suppressed").in("key", keys).abortSignal(signal());
      if (error) fail("read", error);
      return (data ?? []) as ThrottleRow[];
    },
    async insert(row) {
      const { error } = await table().insert(row).abortSignal(signal());
      if (!error) return true;
      if (error.code === "23505") return false;
      return fail("insert", error);
    },
    async claim(key, cutoff, next) {
      const { data, error } = await table()
        .update(next)
        .eq("key", key)
        .lte("last_sent_at", cutoff)
        .select("key")
        .abortSignal(signal());
      if (error) fail("claim", error);
      return (data?.length ?? 0) > 0;
    },
    async setSuppressed(key, from, to) {
      const { data, error } = await table()
        .update({ suppressed: to })
        .eq("key", key)
        .eq("suppressed", from)
        .select("key")
        .abortSignal(signal());
      if (error) fail("count", error);
      return (data?.length ?? 0) > 0;
    },
    async release(key, sentAtIso, to) {
      const { data, error } = await table()
        .update({ last_sent_at: to })
        .eq("key", key)
        .eq("last_sent_at", sentAtIso)
        .select("key")
        .abortSignal(signal());
      if (error) fail("release", error);
      return (data?.length ?? 0) > 0;
    },
  };
}
