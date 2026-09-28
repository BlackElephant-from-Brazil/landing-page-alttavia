import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  budgetedStore,
  CAP_PER_WINDOW,
  capKeys,
  DAY_CAP,
  DAY_WINDOW_MS,
  dayCapKeys,
  decideWithStore,
  KEY_WINDOW_MS,
  MemoryThrottle,
  releaseClaim,
  RETRY_AFTER_MS,
  supabaseThrottleStore,
  throttleKey,
  type ThrottleRow,
  type ThrottleStore,
} from "./throttle";

/**
 * The throttle of the operations alerts against a fake database: one email
 * per key every 30 minutes, 20 an hour in all, the held count carried into
 * the next email, and lost races that stay quiet. Plus the store on
 * `ops_alerts` against a fake PostgREST builder. No network.
 */

const T0 = Date.parse("2026-09-28T12:00:00Z");
const MIN = 60 * 1000;
const KEY = throttleKey("production", "server_error", "route:/api/checkout");

/** A store over a Map with the same conditional semantics the database gives. */
class FakeStore implements ThrottleStore {
  rows = new Map<string, ThrottleRow>();
  calls: string[] = [];
  failOn: string | null = null;

  private check(method: string) {
    this.calls.push(method);
    if (this.failOn === method || this.failOn === "*") throw new Error(`fake ${method} failed`);
  }

  async read(keys: string[]) {
    this.check("read");
    return keys.flatMap((key) => (this.rows.has(key) ? [{ ...(this.rows.get(key) as ThrottleRow) }] : []));
  }

  async insert(row: ThrottleRow) {
    this.check("insert");
    if (this.rows.has(row.key)) return false;
    this.rows.set(row.key, { ...row });
    return true;
  }

  async claim(key: string, cutoff: string, next: { last_sent_at: string; suppressed: number }) {
    this.check("claim");
    const row = this.rows.get(key);
    if (!row || Date.parse(row.last_sent_at) > Date.parse(cutoff)) return false;
    this.rows.set(key, { key, ...next });
    return true;
  }

  async setSuppressed(key: string, from: number, to: number) {
    this.check("setSuppressed");
    const row = this.rows.get(key);
    if (!row || row.suppressed !== from) return false;
    row.suppressed = to;
    return true;
  }

  async release(key: string, sentAt: string, to: string) {
    this.check("release");
    const row = this.rows.get(key);
    if (!row || row.last_sent_at !== sentAt) return false;
    row.last_sent_at = to;
    return true;
  }
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

describe("throttleKey and capKeys", () => {
  it("namespaces by environment and kind, and bounds the length", () => {
    expect(throttleKey("staging", "webhook", "record_failed")).toBe("staging:webhook:record_failed");
    expect(throttleKey("production", "server_error", "x".repeat(500))).toHaveLength(200);
    expect(capKeys("production")).toHaveLength(CAP_PER_WINDOW);
    expect(capKeys("production")[0]).toBe("cap:production:00");
    expect(capKeys("staging")[19]).toBe("cap:staging:19");
    expect(dayCapKeys("production")).toHaveLength(DAY_CAP);
    expect(dayCapKeys("production")[29]).toBe("day:production:29");
  });
});

describe("decideWithStore", () => {
  it("sends the first alert of a key and records it", async () => {
    const store = new FakeStore();

    expect(await decideWithStore(store, KEY, "production", T0)).toMatchObject({ send: true, moreSince: 0 });
    expect(store.rows.get(KEY)).toMatchObject({ last_sent_at: new Date(T0).toISOString(), suppressed: 0 });
    expect([...store.rows.keys()].filter((key) => key.startsWith("cap:production:"))).toHaveLength(1);
  });

  it("holds the same key for 30 minutes and counts what it held", async () => {
    const store = new FakeStore();
    await decideWithStore(store, KEY, "production", T0);

    expect(await decideWithStore(store, KEY, "production", T0 + 1 * MIN)).toMatchObject({ send: false, reason: "throttled" });
    expect(await decideWithStore(store, KEY, "production", T0 + 29 * MIN)).toMatchObject({ send: false, reason: "throttled" });
    expect(store.rows.get(KEY)?.suppressed).toBe(2);
  });

  it("sends again after the window and reports how many were held, then resets the count", async () => {
    const store = new FakeStore();
    await decideWithStore(store, KEY, "production", T0);
    await decideWithStore(store, KEY, "production", T0 + 5 * MIN);
    await decideWithStore(store, KEY, "production", T0 + 10 * MIN);
    await decideWithStore(store, KEY, "production", T0 + 15 * MIN);

    expect(await decideWithStore(store, KEY, "production", T0 + KEY_WINDOW_MS)).toMatchObject({ send: true, moreSince: 3 });
    expect(store.rows.get(KEY)?.suppressed).toBe(0);
  });

  it("keeps other keys and other environments apart", async () => {
    const store = new FakeStore();
    await decideWithStore(store, KEY, "production", T0);

    const other = throttleKey("production", "webhook", "record_failed");
    const staging = throttleKey("staging", "server_error", "route:/api/checkout");
    expect(await decideWithStore(store, other, "production", T0 + MIN)).toMatchObject({ send: true, moreSince: 0 });
    expect(await decideWithStore(store, staging, "staging", T0 + MIN)).toMatchObject({ send: true, moreSince: 0 });
  });

  it("lets only one of two instances win a new key", async () => {
    const store = new FakeStore();
    // The second instance read before the first inserted: it sees no row and its insert conflicts.
    const racing: ThrottleStore = {
      ...store,
      read: async (keys) => (keys.includes(KEY) ? [] : store.read(keys)),
      insert: (row) => store.insert(row),
      claim: (key, cutoff, next) => store.claim(key, cutoff, next),
      setSuppressed: (key, from, to) => store.setSuppressed(key, from, to),
      release: (key, sentAt, to) => store.release(key, sentAt, to),
    };

    expect(await decideWithStore(store, KEY, "production", T0)).toMatchObject({ send: true, moreSince: 0 });
    expect(await decideWithStore(racing, KEY, "production", T0)).toMatchObject({ send: false, reason: "throttled" });
  });

  it("lets only one of two instances claim an expired key", async () => {
    const store = new FakeStore();
    store.rows.set(KEY, { key: KEY, last_sent_at: new Date(T0 - 2 * KEY_WINDOW_MS).toISOString(), suppressed: 4 });
    const staleRead = [{ ...(store.rows.get(KEY) as ThrottleRow) }];
    const racing: ThrottleStore = {
      read: async (keys) => (keys.includes(KEY) ? staleRead : store.read(keys)),
      insert: (row) => store.insert(row),
      claim: (key, cutoff, next) => store.claim(key, cutoff, next),
      setSuppressed: (key, from, to) => store.setSuppressed(key, from, to),
      release: (key, sentAt, to) => store.release(key, sentAt, to),
    };

    expect(await decideWithStore(store, KEY, "production", T0)).toMatchObject({ send: true, moreSince: 4 });
    expect(await decideWithStore(racing, KEY, "production", T0)).toMatchObject({ send: false, reason: "throttled" });
  });

  it("stops at 20 emails per rolling hour across keys, and carries the capped one into the next email", async () => {
    const store = new FakeStore();
    for (let i = 0; i < CAP_PER_WINDOW; i += 1) {
      const decision = await decideWithStore(store, throttleKey("production", "server_error", `route:/r${i}`), "production", T0 + i);
      expect(decision.send).toBe(true);
    }

    const capped = throttleKey("production", "server_error", "route:/r20");
    expect(await decideWithStore(store, capped, "production", T0 + MIN)).toMatchObject({ send: false, reason: "capped" });
    expect(store.rows.get(capped)?.suppressed).toBe(1);

    // Another environment has its own cap.
    expect((await decideWithStore(store, throttleKey("staging", "server_error", "route:/r0"), "staging", T0 + MIN)).send).toBe(true);

    // An hour after the first slots were taken, the key sends and reports the one it held.
    expect(await decideWithStore(store, capped, "production", T0 + 61 * MIN)).toMatchObject({ send: true, moreSince: 1 });
  });

  it("throws when the database fails before a decision, so the caller can fall back", async () => {
    const store = new FakeStore();
    store.failOn = "read";
    await expect(decideWithStore(store, KEY, "production", T0)).rejects.toThrow("fake read failed");

    const inserting = new FakeStore();
    inserting.failOn = "insert";
    await expect(decideWithStore(inserting, KEY, "production", T0)).rejects.toThrow("fake insert failed");
  });

  it("still holds the alert when only the count fails", async () => {
    const store = new FakeStore();
    await decideWithStore(store, KEY, "production", T0);
    store.failOn = "setSuppressed";

    expect(await decideWithStore(store, KEY, "production", T0 + MIN)).toMatchObject({ send: false, reason: "throttled" });
  });
});

describe("decideWithStore: windows, the day cap and giving a claim back", () => {
  const HOUR = 60 * MIN;

  it("holds a key for the window the caller gives", async () => {
    const store = new FakeStore();
    await decideWithStore(store, KEY, "production", T0, 6 * HOUR);

    expect(await decideWithStore(store, KEY, "production", T0 + 2 * HOUR, 6 * HOUR)).toMatchObject({ send: false, reason: "throttled", sentAt: T0 });
    expect(await decideWithStore(store, KEY, "production", T0 + 6 * HOUR, 6 * HOUR)).toMatchObject({ send: true, moreSince: 1 });
  });

  it("answers what it claimed: the key, an hour slot and a day slot", async () => {
    const store = new FakeStore();

    const decision = await decideWithStore(store, KEY, "production", T0);

    expect(decision).toEqual({
      send: true,
      moreSince: 0,
      claim: { key: KEY, slots: ["cap:production:00", "day:production:00"], sentAt: new Date(T0).toISOString(), windowMs: KEY_WINDOW_MS, moreSince: 0 },
    });
  });

  it("stops at 30 emails per rolling day, gives the hour slot back, and sends again a day later", async () => {
    const store = new FakeStore();
    // Two an hour, so the hourly cap never binds.
    for (let i = 0; i < DAY_CAP; i += 1) {
      const decision = await decideWithStore(store, throttleKey("production", "server_error", `route:/d${i}`), "production", T0 + i * 30 * MIN);
      expect(decision.send).toBe(true);
    }
    const at = T0 + DAY_CAP * 30 * MIN;
    const late = throttleKey("production", "server_error", "route:/late");

    expect(await decideWithStore(store, late, "production", at)).toMatchObject({ send: false, reason: "capped" });
    expect(store.rows.get(late)?.suppressed).toBe(1);
    const hourSlots = capKeys("production").map((key) => store.rows.get(key));
    expect(hourSlots.some((row) => row && Date.parse(row.last_sent_at) === at)).toBe(false);

    expect(await decideWithStore(store, late, "production", T0 + DAY_WINDOW_MS + KEY_WINDOW_MS)).toMatchObject({ send: true, moreSince: 1 });
  });

  it("gives a claim back: the slots at once, the key after five minutes, the occurrence counted", async () => {
    const store = new FakeStore();
    const decision = await decideWithStore(store, KEY, "production", T0);
    if (!decision.send || !decision.claim) throw new Error("expected a claim");

    await releaseClaim(store, decision.claim);

    expect(Date.parse(store.rows.get(KEY)?.last_sent_at ?? "")).toBe(T0 - KEY_WINDOW_MS + RETRY_AFTER_MS);
    expect(store.rows.get(KEY)?.suppressed).toBe(1);
    expect(Date.parse(store.rows.get("cap:production:00")?.last_sent_at ?? "")).toBe(0);
    expect(Date.parse(store.rows.get("day:production:00")?.last_sent_at ?? "")).toBe(0);

    expect(await decideWithStore(store, KEY, "production", T0 + MIN)).toMatchObject({ send: false, reason: "throttled" });
    expect(await decideWithStore(store, KEY, "production", T0 + RETRY_AFTER_MS)).toMatchObject({ send: true, moreSince: 2 });
  });

  it("leaves a row another claim has taken since, and never throws", async () => {
    const store = new FakeStore();
    const decision = await decideWithStore(store, KEY, "production", T0);
    if (!decision.send || !decision.claim) throw new Error("expected a claim");
    store.rows.set(KEY, { key: KEY, last_sent_at: new Date(T0 + HOUR).toISOString(), suppressed: 0 });
    store.failOn = "setSuppressed";

    await expect(releaseClaim(store, decision.claim)).resolves.toBeUndefined();
    expect(store.rows.get(KEY)?.last_sent_at).toBe(new Date(T0 + HOUR).toISOString());
  });
});

describe("budgetedStore", () => {
  it("fails every call once the shared budget is spent", async () => {
    const store = new FakeStore();
    const slow: ThrottleStore = {
      read: (keys) => new Promise((resolve) => setTimeout(() => resolve(store.read(keys)), 100)),
      insert: (row) => store.insert(row),
      claim: (key, cutoff, next) => store.claim(key, cutoff, next),
      setSuppressed: (key, from, to) => store.setSuppressed(key, from, to),
      release: (key, sentAt, to) => store.release(key, sentAt, to),
    };
    const budgeted = budgetedStore(slow, 30);

    await expect(budgeted.read([KEY])).rejects.toThrow("over the 30 ms budget");
    await expect(budgeted.insert({ key: KEY, last_sent_at: "x", suppressed: 0 })).rejects.toThrow("over the 30 ms budget");
    expect(store.rows.size).toBe(0);
  });

  it("passes answers through while there is time", async () => {
    const store = new FakeStore();
    const budgeted = budgetedStore(store, 5000);

    expect(await budgeted.insert({ key: KEY, last_sent_at: new Date(T0).toISOString(), suppressed: 0 })).toBe(true);
    expect(await budgeted.read([KEY])).toHaveLength(1);
  });
});

describe("MemoryThrottle", () => {
  it("applies the same rules in one instance", () => {
    const memory = new MemoryThrottle();

    expect(memory.decide("a", T0)).toMatchObject({ send: true, moreSince: 0 });
    expect(memory.decide("a", T0 + MIN)).toMatchObject({ send: false, reason: "throttled" });
    expect(memory.decide("a", T0 + 2 * MIN)).toMatchObject({ send: false, reason: "throttled" });
    expect(memory.decide("a", T0 + KEY_WINDOW_MS)).toMatchObject({ send: true, moreSince: 2 });
  });

  it("caps at 20 per hour and counts the capped one", () => {
    const memory = new MemoryThrottle();
    for (let i = 0; i < CAP_PER_WINDOW; i += 1) expect(memory.decide(`k${i}`, T0 + i).send).toBe(true);

    expect(memory.decide("k20", T0 + MIN)).toMatchObject({ send: false, reason: "capped" });
    expect(memory.decide("k20", T0 + 61 * MIN)).toMatchObject({ send: true, moreSince: 1 });
  });
});

describe("MemoryThrottle: what the database decided, and giving back", () => {
  it("holds a key the database said was sent, counts the repeats and hands them to the next email", () => {
    const memory = new MemoryThrottle();
    expect(memory.holds("a", T0)).toBe(false);

    memory.note("a", T0, true);
    expect(memory.holds("a", T0 + MIN)).toBe(true);
    expect(memory.holds("a", T0 + 2 * MIN)).toBe(true);
    expect(memory.holds("a", T0 + KEY_WINDOW_MS)).toBe(false);
    expect(memory.takeHeld("a")).toBe(2);
    expect(memory.takeHeld("a")).toBe(0);
  });

  it("uses the window it is given", () => {
    const memory = new MemoryThrottle();
    memory.note("a", T0, false);

    expect(memory.holds("a", T0 + 2 * 60 * MIN, 6 * 60 * MIN)).toBe(true);
    expect(memory.decide("b", T0, 6 * 60 * MIN).send).toBe(true);
    expect(memory.decide("b", T0 + 5 * 60 * MIN, 6 * 60 * MIN)).toEqual({ send: false, reason: "throttled" });
  });

  it("gives a failed send back: the key reopens after five minutes with the count restored", () => {
    const memory = new MemoryThrottle();
    expect(memory.decide("a", T0)).toEqual({ send: true, moreSince: 0 });

    memory.giveBack("a", T0, KEY_WINDOW_MS, 1);

    expect(memory.decide("a", T0 + MIN)).toEqual({ send: false, reason: "throttled" });
    expect(memory.decide("a", T0 + RETRY_AFTER_MS)).toEqual({ send: true, moreSince: 2 });
  });

  it("caps at 30 a day in one instance", () => {
    const memory = new MemoryThrottle();
    for (let i = 0; i < DAY_CAP; i += 1) expect(memory.decide(`k${i}`, T0 + i * 30 * MIN).send).toBe(true);

    expect(memory.decide("late", T0 + DAY_CAP * 30 * MIN)).toEqual({ send: false, reason: "capped" });
  });
});

describe("supabaseThrottleStore", () => {
  type Answer = { data?: unknown; error: { code?: string; message: string } | null };

  /** A fake PostgREST builder that records the chain and resolves with `answer` at abortSignal(). */
  function fakeDb(answer: Answer) {
    const chains: string[][] = [];
    const db = {
      from(table: string) {
        const chain = [`from:${table}`];
        chains.push(chain);
        const builder: Record<string, (...args: unknown[]) => unknown> = {};
        for (const method of ["select", "in", "insert", "update", "eq", "lte"]) {
          builder[method] = (...args: unknown[]) => {
            chain.push(`${method}:${JSON.stringify(args)}`);
            return builder;
          };
        }
        builder.abortSignal = (signal: unknown) => {
          chain.push(`abortSignal:${signal instanceof AbortSignal}`);
          return Promise.resolve(answer);
        };
        return builder;
      },
    };
    return { db: db as unknown as Parameters<typeof supabaseThrottleStore>[0], chains };
  }

  it("claims with a conditional update on the key and an old enough last_sent_at", async () => {
    const { db, chains } = fakeDb({ data: [{ key: KEY }], error: null });
    const store = supabaseThrottleStore(db);

    const won = await store.claim(KEY, "2026-09-28T11:30:00.000Z", { last_sent_at: "2026-09-28T12:00:00.000Z", suppressed: 0 });

    expect(won).toBe(true);
    expect(chains[0]).toEqual([
      "from:ops_alerts",
      `update:${JSON.stringify([{ last_sent_at: "2026-09-28T12:00:00.000Z", suppressed: 0 }])}`,
      `eq:${JSON.stringify(["key", KEY])}`,
      `lte:${JSON.stringify(["last_sent_at", "2026-09-28T11:30:00.000Z"])}`,
      `select:${JSON.stringify(["key"])}`,
      "abortSignal:true",
    ]);
  });

  it("reads a lost claim, a unique violation and a count race as false", async () => {
    expect(await supabaseThrottleStore(fakeDb({ data: [], error: null }).db).claim(KEY, "x", { last_sent_at: "y", suppressed: 0 })).toBe(false);
    expect(
      await supabaseThrottleStore(fakeDb({ error: { code: "23505", message: "duplicate key" } }).db).insert({
        key: KEY,
        last_sent_at: "y",
        suppressed: 0,
      }),
    ).toBe(false);
    expect(await supabaseThrottleStore(fakeDb({ data: [], error: null }).db).setSuppressed(KEY, 1, 2)).toBe(false);
  });

  it("gives a claim back only while last_sent_at still reads what this claim wrote", async () => {
    const { db, chains } = fakeDb({ data: [{ key: KEY }], error: null });

    expect(await supabaseThrottleStore(db).release(KEY, "2026-09-28T12:00:00.000Z", "1970-01-01T00:00:00.000Z")).toBe(true);
    expect(chains[0]).toEqual([
      "from:ops_alerts",
      `update:${JSON.stringify([{ last_sent_at: "1970-01-01T00:00:00.000Z" }])}`,
      `eq:${JSON.stringify(["key", KEY])}`,
      `eq:${JSON.stringify(["last_sent_at", "2026-09-28T12:00:00.000Z"])}`,
      `select:${JSON.stringify(["key"])}`,
      "abortSignal:true",
    ]);
  });

  it("guards the count on its previous value", async () => {
    const { db, chains } = fakeDb({ data: [{ key: KEY }], error: null });

    expect(await supabaseThrottleStore(db).setSuppressed(KEY, 3, 4)).toBe(true);
    expect(chains[0]).toContain(`eq:${JSON.stringify(["suppressed", 3])}`);
  });

  it("throws on any other error, a missing table included", async () => {
    const missing = fakeDb({ error: { code: "PGRST205", message: "Could not find the table 'public.ops_alerts'" } }).db;
    await expect(supabaseThrottleStore(missing).read([KEY])).rejects.toThrow("PGRST205");
    await expect(supabaseThrottleStore(missing).insert({ key: KEY, last_sent_at: "y", suppressed: 0 })).rejects.toThrow("ops_alerts insert");
  });
});
