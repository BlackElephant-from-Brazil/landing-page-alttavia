import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * sendOpsAlert with a spied sender, a stand in for the admin client and a
 * fake throttle store: who gets the alert, when nothing is sent, what the
 * email may carry, the database fallback, and that it never throws or
 * keeps its caller waiting. Plus the opsAlert template. No network.
 */

const { sendEmail, createAdminClient } = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email/send", () => ({ sendEmail }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { opsAlert } from "@/lib/email/templates";

import { sendOpsAlert, type OpsAlertInput } from "./alerts";
import { KEY_WINDOW_MS, MemoryThrottle, RETRY_AFTER_MS, type ThrottleRow, type ThrottleStore } from "./throttle";

const T0 = Date.parse("2026-09-28T12:00:00Z");
const ORDER_ID = "33333333-3333-4333-8333-333333333333";

/** A Map backed store with the database's conditional semantics. */
function fakeStore(): ThrottleStore & { rows: Map<string, ThrottleRow> } {
  const rows = new Map<string, ThrottleRow>();
  return {
    rows,
    async read(keys) {
      return keys.flatMap((key) => (rows.has(key) ? [{ ...(rows.get(key) as ThrottleRow) }] : []));
    },
    async insert(row) {
      if (rows.has(row.key)) return false;
      rows.set(row.key, { ...row });
      return true;
    },
    async claim(key, cutoff, next) {
      const row = rows.get(key);
      if (!row || Date.parse(row.last_sent_at) > Date.parse(cutoff)) return false;
      rows.set(key, { key, ...next });
      return true;
    },
    async setSuppressed(key, from, to) {
      const row = rows.get(key);
      if (!row || row.suppressed !== from) return false;
      row.suppressed = to;
      return true;
    },
    async release(key, sentAt, to) {
      const row = rows.get(key);
      if (!row || row.last_sent_at !== sentAt) return false;
      row.last_sent_at = to;
      return true;
    },
  };
}

/** A fresh store and a fresh instance memory, so no call inherits what another test decided. */
function fresh(now: number = T0) {
  return { store: fakeStore(), memory: new MemoryThrottle(), now };
}

function alert(overrides: Partial<OpsAlertInput> = {}): OpsAlertInput {
  return {
    kind: "server_error",
    key: "route:/api/checkout",
    subject: "Server error: route /api/checkout",
    facts: [
      { label: "Method", value: "POST" },
      { label: "Error", value: "Error: checkout failed for ana.silva@example.com" },
    ],
    ...overrides,
  };
}

function sent(): { to: string; subject: string; html: string; text: string } {
  expect(sendEmail).toHaveBeenCalledTimes(1);
  return sendEmail.mock.calls[0][0];
}

let info: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CONTEXT", "production");
  vi.stubEnv("ALERTS_TO", "alerts@example.com");
  vi.stubEnv("FEEDBACK_TO", "feedback@example.com");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://bank-nif-portugal.alttavia-relocation.com");
  sendEmail.mockReset().mockResolvedValue({ ok: true, id: "email_1" });
  createAdminClient.mockReset().mockImplementation(() => {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set. See .env.example.");
  });
  info = vi.spyOn(console, "info").mockImplementation(() => {});
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  info.mockRestore();
  warn.mockRestore();
  error.mockRestore();
});

describe("sendOpsAlert: who and when", () => {
  it("only logs outside a production build, without touching the database or the sender", async () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(await sendOpsAlert(alert(), { memory: new MemoryThrottle() })).toBe("logged");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
    expect(String(info.mock.calls[0][0])).toContain("[production] Server error: route /api/checkout");
    expect(String(info.mock.calls[0][0])).not.toContain("ana.silva@");
  });

  it("goes to ALERTS_TO first, then FEEDBACK_TO", async () => {
    expect(await sendOpsAlert(alert(), fresh())).toBe("sent");
    expect(sent().to).toBe("alerts@example.com");

    sendEmail.mockClear();
    vi.stubEnv("ALERTS_TO", "");
    expect(await sendOpsAlert(alert(), fresh())).toBe("sent");
    expect(sent().to).toBe("feedback@example.com");
  });

  it("warns and sends nothing when neither address is set", async () => {
    vi.stubEnv("ALERTS_TO", "");
    vi.stubEnv("FEEDBACK_TO", " ");

    expect(await sendOpsAlert(alert(), fresh())).toBe("no_recipient");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("prefixes the subject with the environment from CONTEXT", async () => {
    vi.stubEnv("CONTEXT", "branch-deploy");
    await sendOpsAlert(alert(), fresh());
    expect(sent().subject).toBe("[staging] Server error: route /api/checkout");

    sendEmail.mockClear();
    vi.stubEnv("CONTEXT", "");
    await sendOpsAlert(alert(), fresh());
    expect(sent().subject).toBe("[local] Server error: route /api/checkout");
  });

  it("reports sendEmail's refusal as send_failed", async () => {
    sendEmail.mockResolvedValue({ ok: false });

    expect(await sendOpsAlert(alert(), fresh())).toBe("send_failed");
  });
});

describe("sendOpsAlert: what the email carries", () => {
  it("cleans every fact, adds the environment and the time in Lisbon, and keeps 5 stack frames", async () => {
    const stack = ["Error: boom", ...Array.from({ length: 8 }, (_, i) => `    at frame${i} (/var/task/f${i}.js:1:1)`)].join("\n");

    await sendOpsAlert(alert({ stack, facts: [{ label: "Path", value: "/en/login?email=a@b.com" }, { label: "Note", value: "z".repeat(900) }] }), {
      store: fakeStore(),
      now: T0,
    });
    const email = sent();

    expect(email.text).not.toContain("a@b.com");
    expect(email.text).toContain("Path: /en/login?[query]");
    expect(email.text).toContain(`Note: ${"z".repeat(297)}...`);
    expect(email.text).toContain("Environment: production");
    expect(email.text).toContain("Time in Lisbon: 28 Sept 2026, 13:00:00");
    expect(email.text).toContain("at frame4");
    expect(email.text).not.toContain("at frame5");
    expect(email.html).not.toContain("a@b.com");
  });

  it("never carries an email address from the facts", async () => {
    await sendOpsAlert(alert(), fresh());
    const email = sent();

    expect(email.text).toContain("Error: Error: checkout failed for [email]");
    expect(email.html).not.toContain("ana.silva");
  });

  it("adds a button only for an admin path", async () => {
    await sendOpsAlert(alert({ link: { label: "Open the order", path: `/admin/orders?order=${ORDER_ID}` } }), fresh());
    expect(sent().text).toContain(`Open the order: https://bank-nif-portugal.alttavia-relocation.com/admin/orders?order=${ORDER_ID}`);

    sendEmail.mockClear();
    await sendOpsAlert(alert({ link: { label: "Elsewhere", path: "https://evil.example/" } }), fresh());
    expect(sent().text).not.toContain("Elsewhere");
    expect(sent().html).not.toContain("evil.example");
  });
});

describe("sendOpsAlert: throttle", () => {
  it("holds the same key for 30 minutes, then says how many were held", async () => {
    const store = fakeStore();
    const memory = new MemoryThrottle();

    expect(await sendOpsAlert(alert(), { store, memory, now: T0 })).toBe("sent");
    expect(await sendOpsAlert(alert(), { store, memory, now: T0 + 60_000 })).toBe("throttled");
    expect(await sendOpsAlert(alert(), { store, memory, now: T0 + 120_000 })).toBe("throttled");
    expect(sendEmail).toHaveBeenCalledTimes(1);

    expect(await sendOpsAlert(alert(), { store, memory, now: T0 + KEY_WINDOW_MS })).toBe("sent");
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls[1][0].text).toContain("2 more since the last email.");
    expect([...store.rows.keys()]).toContain("production:server_error:route:/api/checkout");
  });

  it("falls back to this instance's memory and sends when the database cannot be reached", async () => {
    const memory = new MemoryThrottle();

    expect(await sendOpsAlert(alert(), { memory, now: T0 })).toBe("sent");
    expect(createAdminClient).toHaveBeenCalledTimes(1);
    expect(await sendOpsAlert(alert(), { memory, now: T0 + 60_000 })).toBe("throttled");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("throttle table unavailable");
  });

  it("falls back as well when the table read fails", async () => {
    const broken: ThrottleStore = {
      read: async () => {
        throw new Error("ops_alerts read: PGRST205 Could not find the table");
      },
      insert: async () => true,
      claim: async () => true,
      setSuppressed: async () => true,
      release: async () => true,
    };

    expect(await sendOpsAlert(alert(), { store: broken, memory: new MemoryThrottle(), now: T0 })).toBe("sent");
  });
});

describe("sendOpsAlert: what a stranger can set off, slow databases and failed sends", () => {
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  const unreachable: ThrottleStore = {
    read: async () => {
      throw new Error("ops_alerts read: PGRST205 Could not find the table");
    },
    insert: async () => true,
    claim: async () => true,
    setSuppressed: async () => true,
    release: async () => true,
  };

  it("only logs an alert with failOpen false when the shared throttle cannot be read", async () => {
    const memory = new MemoryThrottle();
    const stranger = alert({ kind: "webhook", key: "invalid_signature", failOpen: false });

    expect(await sendOpsAlert(stranger, { store: unreachable, memory, now: T0 })).toBe("store_unavailable");
    expect(await sendOpsAlert(stranger, { memory, now: T0 + 1 })).toBe("store_unavailable");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(String(warn.mock.calls[0][0])).toContain("logged only");
  });

  it("still sends an alert with failOpen false while the shared throttle works", async () => {
    expect(await sendOpsAlert(alert({ kind: "webhook", key: "invalid_signature", failOpen: false }), fresh())).toBe("sent");
  });

  it("holds a key for the window the caller gives, and says so in the email", async () => {
    const store = fakeStore();
    const memory = new MemoryThrottle();
    const long = alert({ kind: "webhook", key: "invalid_signature", windowMs: SIX_HOURS });

    expect(await sendOpsAlert(long, { store, memory, now: T0 })).toBe("sent");
    expect(sendEmail.mock.calls[0][0].text).toContain("held for 6 hours");
    expect(await sendOpsAlert(long, { store, memory: new MemoryThrottle(), now: T0 + 2 * 60 * 60 * 1000 })).toBe("throttled");
    expect(await sendOpsAlert(long, { store, memory, now: T0 + SIX_HOURS })).toBe("sent");
    expect(sendEmail.mock.calls[1][0].text).toContain("1 more since the last email.");
  });

  it("holds a repeat this instance already knows about without asking the database", async () => {
    const store = fakeStore();
    const read = vi.spyOn(store, "read");
    const memory = new MemoryThrottle();

    expect(await sendOpsAlert(alert(), { store, memory, now: T0 })).toBe("sent");
    const reads = read.mock.calls.length;
    expect(await sendOpsAlert(alert(), { store, memory, now: T0 + 60_000 })).toBe("throttled");
    expect(await sendOpsAlert(alert(), { store, memory, now: T0 + 120_000 })).toBe("throttled");
    expect(read.mock.calls.length).toBe(reads);

    // The repeats held in this instance are reported by its next email.
    expect(await sendOpsAlert(alert(), { store, memory, now: T0 + KEY_WINDOW_MS })).toBe("sent");
    expect(sendEmail.mock.calls[1][0].text).toContain("2 more since the last email.");
  });

  it("gives the claim back when Resend refuses the email: the key retries five minutes later and counts the lost one", async () => {
    const store = fakeStore();
    sendEmail.mockResolvedValueOnce({ ok: false });

    expect(await sendOpsAlert(alert(), { store, memory: new MemoryThrottle(), now: T0 })).toBe("send_failed");
    const key = "production:server_error:route:/api/checkout";
    expect(Date.parse(store.rows.get(key)?.last_sent_at ?? "")).toBe(T0 - KEY_WINDOW_MS + RETRY_AFTER_MS);
    expect(store.rows.get(key)?.suppressed).toBe(1);
    const slots = [...store.rows.values()].filter((row) => row.key.startsWith("cap:") || row.key.startsWith("day:"));
    expect(slots.every((row) => Date.parse(row.last_sent_at) === 0)).toBe(true);

    expect(await sendOpsAlert(alert(), { store, memory: new MemoryThrottle(), now: T0 + 60_000 })).toBe("throttled");
    expect(await sendOpsAlert(alert(), { store, memory: new MemoryThrottle(), now: T0 + RETRY_AFTER_MS })).toBe("sent");
    expect(sendEmail.mock.calls[1][0].text).toContain("2 more since the last email.");
  });

  it("gives a memory decision back too when the email fails", async () => {
    const memory = new MemoryThrottle();
    sendEmail.mockResolvedValueOnce({ ok: false });

    expect(await sendOpsAlert(alert(), { store: unreachable, memory, now: T0 })).toBe("send_failed");
    expect(await sendOpsAlert(alert(), { store: unreachable, memory, now: T0 + 60_000 })).toBe("throttled");
    expect(await sendOpsAlert(alert(), { store: unreachable, memory, now: T0 + RETRY_AFTER_MS })).toBe("sent");
  });

  it("falls back to memory within the budget when every database call is slow", async () => {
    const slow = fakeStore();
    const read = slow.read.bind(slow);
    slow.read = (keys) => new Promise((resolve) => setTimeout(() => resolve(read(keys)), 200));

    const started = Date.now();
    expect(await sendOpsAlert(alert(), { store: slow, memory: new MemoryThrottle(), now: T0, storeBudgetMs: 50 })).toBe("sent");
    expect(Date.now() - started).toBeLessThan(1000);
    expect(String(warn.mock.calls[0][0])).toContain("over the 50 ms budget");
  });
});

describe("sendOpsAlert: never throws, never keeps the caller waiting", () => {
  it("answers failed when the sender throws", async () => {
    sendEmail.mockRejectedValue(new Error("network down for ana@example.com"));

    expect(await sendOpsAlert(alert(), fresh())).toBe("failed");
    expect(String(error.mock.calls[0][0])).not.toContain("ana@example.com");
  });

  it("survives input that is not what the type says", async () => {
    const odd = { kind: "server_error", key: null, subject: undefined, facts: null } as unknown as OpsAlertInput;

    await expect(sendOpsAlert(odd, fresh())).resolves.toBe("sent");
    await expect(sendOpsAlert(undefined as unknown as OpsAlertInput)).resolves.toBe("failed");
  });

  it("stops waiting at the deadline when the database hangs", async () => {
    const hanging: ThrottleStore = {
      read: () => new Promise(() => {}),
      insert: async () => true,
      claim: async () => true,
      setSuppressed: async () => true,
      release: async () => true,
    };

    const started = Date.now();
    // A budget longer than the test, so nothing is sent in the background once it has ended.
    expect(
      await sendOpsAlert(alert(), { store: hanging, memory: new MemoryThrottle(), now: T0, deadlineMs: 50, storeBudgetMs: 60_000 }),
    ).toBe("timed_out");
    expect(Date.now() - started).toBeLessThan(2000);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("opsAlert template", () => {
  const BANNED = /\b(problem|trap|free|refund|money back|video call|run by lawyers)\b/i;

  function sample(kind: "server_error" | "webhook", moreSince = 0) {
    return opsAlert({
      prefix: "[production]",
      kind,
      subject: kind === "webhook" ? "Stripe webhook: a payment could not be recorded" : "Server error: render /[locale]/dashboard",
      facts: [
        { label: "Order", value: ORDER_ID },
        { label: "Error", value: "Error: <b>boom</b> & more" },
      ],
      stack: ["at one (/var/task/a.js:1:1)", "at two (/var/task/b.js:2:2)"],
      moreSince,
      link: kind === "webhook" ? { label: "Open the order", url: `https://example.com/admin/orders?order=${ORDER_ID}` } : undefined,
    });
  }

  it("prefixes the subject, lists the facts and the stack, and signs for the team", () => {
    const email = sample("server_error");

    expect(email.subject).toBe("[production] Server error: render /[locale]/dashboard");
    expect(email.text).toContain(`Order: ${ORDER_ID}`);
    expect(email.text).toContain("First stack lines:");
    expect(email.text).toContain("at two (/var/task/b.js:2:2)");
    expect(email.text).toContain("Sent to the team inbox only.");
    expect(email.text).not.toContain("Reply to this email");
    expect(email.text).not.toContain("more since the last email");
  });

  it("has no button without a link, and one with it", () => {
    expect(sample("server_error").html).not.toContain("border-radius:999px");
    const webhook = sample("webhook", 3);
    expect(webhook.html).toContain(`href="https://example.com/admin/orders?order=${ORDER_ID}"`);
    expect(webhook.text).toContain("3 more since the last email.");
  });

  it("escapes what it prints", () => {
    const email = sample("server_error");

    expect(email.html).not.toContain("<b>boom</b>");
    expect(email.html).toContain("&lt;b&gt;boom&lt;/b&gt; &amp; more");
  });

  it.each(["server_error", "webhook"] as const)("%s keeps the house rules", (kind) => {
    const email = sample(kind, 2);
    for (const copy of [email.subject, email.text]) {
      expect(copy).not.toMatch(/[–—]/);
      expect(copy).not.toMatch(/\s-\s/);
      expect(copy).not.toMatch(BANNED);
    }
  });
});
