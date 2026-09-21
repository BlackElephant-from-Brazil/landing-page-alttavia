import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UserServiceRow } from "@/lib/db/types";

/**
 * confirmCheckoutSession against a fake Stripe and a fake database. No
 * network: the Stripe SDK and the admin client are replaced with vi.mock
 * before the module under test loads, and markOrderPaid is a spy so the test
 * can assert what would have been written without a database. The payment
 * emails run for real (src/lib/orders/notify.ts) with the sender spied.
 */

// vi.mock is hoisted above every import, so anything a factory touches has to
// be hoisted with it.
const { retrieve, markOrderPaid, sendEmail, tables } = vi.hoisted(() => ({
  retrieve: vi.fn(),
  markOrderPaid: vi.fn(),
  sendEmail: vi.fn(),
  /** The rows the fake admin client answers with, keyed by table. */
  tables: { user_services: [] } as Record<string, Record<string, unknown>[]>,
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({ checkout: { sessions: { retrieve } } }),
}));

vi.mock("@/lib/orders/mark-paid", () => ({ markOrderPaid }));

vi.mock("@/lib/email/send", () => ({ sendEmail }));

// The dashboard page renders inside a request; here there is none, so the
// emails read the host the dev server would have seen.
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "localhost:3000" }) }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const filters: [string, unknown][] = [];
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return query;
        },
        maybeSingle() {
          const rows = tables[table] ?? [];
          const match = rows.find((row) => filters.every(([column, value]) => row[column] === value));
          return Promise.resolve({ data: match ?? null, error: null });
        },
      };
      return query;
    },
  }),
}));

import { confirmCheckoutSession, settleVerifiedSession, verifyPaidSession } from "./confirm";

const OWNER = "11111111-1111-4111-8111-111111111111";
const STRANGER = "22222222-2222-4222-8222-222222222222";
const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const SERVICE_ID = "44444444-4444-4444-8444-444444444444";
const SESSION_ID = "cs_test_a1B2c3D4e5F6g7H8";
const TEAM = "team@example.com";

const order: UserServiceRow = {
  id: ORDER_ID,
  user_id: OWNER,
  service_id: SERVICE_ID,
  submission_id: null,
  answers_snapshot: { applicants: "one", hasNif: [false], bank: "yes" },
  joint: false,
  applicants: 1,
  total_cents: 49700,
  currency: "eur",
  stage_key: "awaiting_payment",
  stripe_checkout_session_id: null,
  stripe_payment_intent_id: null,
  paid_at: null,
  completed_at: null,
  report: null,
  created_at: "2026-09-11T10:00:00.000Z",
  updated_at: "2026-09-11T10:00:00.000Z",
};

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    object: "checkout.session",
    payment_status: "paid",
    client_reference_id: ORDER_ID,
    amount_total: 49700,
    currency: "eur",
    payment_intent: "pi_test_123",
    ...overrides,
  };
}

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  retrieve.mockReset();
  markOrderPaid.mockReset();
  markOrderPaid.mockResolvedValue({ changed: true, stageKey: "documents" });
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true, id: "email_1" });
  tables.user_services = [order];
  tables.services = [{ id: SERVICE_ID, name: "NIF + Bank Account", contract_template: "package" }];
  tables.users = [{ id: OWNER, email: "client@example.com" }];
  vi.stubEnv("EMAIL_TEAM_INBOX", TEAM);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  logged = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  logged.mockRestore();
});

/** Recipients of every email sent so far, in order. */
function recipients(): string[] {
  return sendEmail.mock.calls.map((call) => call[0].to as string);
}

describe("confirmCheckoutSession", () => {
  it("marks the order paid when the session is paid for the right amount", async () => {
    retrieve.mockResolvedValue(session());

    const result = await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(result).toEqual({ ok: true, userServiceId: ORDER_ID });
    expect(markOrderPaid).toHaveBeenCalledWith(ORDER_ID, {
      sessionId: SESSION_ID,
      paymentIntentId: "pi_test_123",
      amountCents: 49700,
      currency: "eur",
    });
  });

  it("accepts the currency in any case and an expanded payment intent", async () => {
    retrieve.mockResolvedValue(session({ currency: "EUR", payment_intent: { id: "pi_test_456" } }));

    const result = await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(result.ok).toBe(true);
    expect(markOrderPaid).toHaveBeenCalledWith(ORDER_ID, expect.objectContaining({ paymentIntentId: "pi_test_456" }));
  });

  it("refuses a session that is not paid", async () => {
    retrieve.mockResolvedValue(session({ payment_status: "unpaid" }));

    const result = await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(result.ok).toBe(false);
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("refuses a session whose amount differs from the order total", async () => {
    retrieve.mockResolvedValue(session({ amount_total: 14900 }));

    const result = await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(result).toEqual({ ok: false, reason: "Paid amount does not match the order." });
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("refuses a session whose currency differs from the order", async () => {
    retrieve.mockResolvedValue(session({ currency: "usd" }));

    const result = await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(result.ok).toBe(false);
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("refuses an order that belongs to another account", async () => {
    retrieve.mockResolvedValue(session());

    const result = await confirmCheckoutSession(SESSION_ID, STRANGER);

    expect(result).toEqual({ ok: false, reason: "This order belongs to another account." });
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("refuses a session that references no known order", async () => {
    retrieve.mockResolvedValue(session({ client_reference_id: "55555555-5555-4555-8555-555555555555" }));

    const result = await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(result.ok).toBe(false);
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("never calls Stripe for a malformed session id", async () => {
    const result = await confirmCheckoutSession("../etc/passwd", OWNER);

    expect(result.ok).toBe(false);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("reports a session Stripe cannot find without throwing", async () => {
    retrieve.mockRejectedValue(new Error("No such checkout.session"));

    const result = await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(result).toEqual({ ok: false, reason: "Session not found." });
  });

  it("reports a failed write without throwing", async () => {
    retrieve.mockResolvedValue(session());
    markOrderPaid.mockRejectedValue(new Error("connection reset"));

    const result = await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(result.ok).toBe(false);
  });
});

describe("verifyPaidSession on a wrong amount", () => {
  it("hands back the order it names, so the webhook can tell the team", async () => {
    const result = await verifyPaidSession(session({ amount_total: 14900 }) as never);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("Paid amount does not match the order.");
    expect(result.mismatchedOrder?.id).toBe(ORDER_ID);
  });

  it("hands back the order on a wrong currency too", async () => {
    const result = await verifyPaidSession(session({ currency: "usd" }) as never);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.mismatchedOrder?.id).toBe(ORDER_ID);
  });

  it("names no order for a session that is simply not paid", async () => {
    const result = await verifyPaidSession(session({ payment_status: "unpaid", amount_total: 14900 }) as never);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.mismatchedOrder).toBeUndefined();
  });
});

describe("the payment emails", () => {
  it("sends Payment received to the client and New paid order to the team on the first payment", async () => {
    retrieve.mockResolvedValue(session());

    const result = await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(result).toEqual({ ok: true, userServiceId: ORDER_ID });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(recipients().sort()).toEqual(["client@example.com", TEAM]);

    const client = sendEmail.mock.calls.find((call) => call[0].to === "client@example.com")?.[0];
    expect(client.subject).toBe("Payment received for your NIF + Bank Account order");
    expect(client.text).toContain(`http://localhost:3000/en/dashboard/orders/${ORDER_ID}`);

    const team = sendEmail.mock.calls.find((call) => call[0].to === TEAM)?.[0];
    expect(team.subject).toBe("New paid order: NIF + Bank Account, €497");
    expect(team.text).toContain("Client: client@example.com");
    expect(team.text).toContain(`http://localhost:3000/admin/orders?order=${ORDER_ID}`);
  });

  it("sends nothing on a repeat, when the order was already paid", async () => {
    retrieve.mockResolvedValue(session());
    markOrderPaid.mockResolvedValue({ changed: false, stageKey: "documents" });

    const result = await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(result).toEqual({ ok: true, userServiceId: ORDER_ID });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends once when the webhook and the dashboard return both settle the same session", async () => {
    // The webhook wins the conditional update; the dashboard return finds the order paid.
    markOrderPaid.mockResolvedValueOnce({ changed: true, stageKey: "documents" });
    markOrderPaid.mockResolvedValueOnce({ changed: false, stageKey: "documents" });

    const verified = await verifyPaidSession(session() as never);
    if (!verified.ok) throw new Error(verified.reason);
    await settleVerifiedSession(verified.verified);

    retrieve.mockResolvedValue(session());
    await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(markOrderPaid).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(recipients().sort()).toEqual(["client@example.com", TEAM]);
  });

  it("skips the team email without EMAIL_TEAM_INBOX and still tells the client", async () => {
    vi.stubEnv("EMAIL_TEAM_INBOX", "");
    retrieve.mockResolvedValue(session());

    const result = await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(result.ok).toBe(true);
    expect(recipients()).toEqual(["client@example.com"]);
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it("records the payment even when every email fails", async () => {
    retrieve.mockResolvedValue(session());
    sendEmail.mockRejectedValue(new Error("socket hang up"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await confirmCheckoutSession(SESSION_ID, OWNER);

    expect(result).toEqual({ ok: true, userServiceId: ORDER_ID });
    error.mockRestore();
  });

  it("builds the links on an origin the caller gives", async () => {
    const verified = await verifyPaidSession(session() as never);
    if (!verified.ok) throw new Error(verified.reason);

    await settleVerifiedSession(verified.verified, { origin: "https://preview.example.com" });

    const client = sendEmail.mock.calls.find((call) => call[0].to === "client@example.com")?.[0];
    expect(client.text).toContain(`https://preview.example.com/en/dashboard/orders/${ORDER_ID}`);
  });
});

// ---------------------------------------------------------------------------
// The payment path must never reach the service agreement code: a contract
// hook must not be able to turn a Stripe webhook into a 500. The source is
// followed from each entry point through every local import that survives
// compilation (type only imports do not), lazy `import()` calls included,
// since that is how the payment emails are loaded.
// ---------------------------------------------------------------------------

describe("what the payment path pulls in", () => {
  const SRC = fileURLToPath(new URL("../../", import.meta.url));
  const STATEMENT = /^[ \t]*(?:import|export)\b([^;'"]*?)\bfrom\s*["']([^"']+)["']|^[ \t]*import\s*["']([^"']+)["']/gm;
  const LAZY = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

  function resolveLocal(specifier: string, from: string): string | null {
    const base = specifier.startsWith("@/")
      ? path.join(SRC, specifier.slice(2))
      : specifier.startsWith(".")
        ? path.resolve(path.dirname(from), specifier)
        : null;
    if (base === null) return null;
    for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
      if (existsSync(candidate)) return candidate;
    }
    throw new Error(`cannot resolve ${specifier} from ${from}`);
  }

  function reachedFiles(entry: string): string[] {
    const seen = new Set<string>();
    const queue = [path.join(SRC, entry)];
    while (queue.length > 0) {
      const file = queue.pop() as string;
      if (seen.has(file)) continue;
      seen.add(file);
      const source = readFileSync(file, "utf8");
      for (const [, clause = "", from, sideEffect] of source.matchAll(STATEMENT)) {
        if (/^\s*type\b/.test(clause)) continue;
        const local = resolveLocal(from ?? sideEffect, file);
        if (local) queue.push(local);
      }
      for (const [, specifier] of source.matchAll(LAZY)) {
        const local = resolveLocal(specifier, file);
        if (local) queue.push(local);
      }
    }
    return [...seen].map((file) => path.relative(SRC, file).replace(/\\/g, "/"));
  }

  it.each(["lib/stripe/confirm.ts", "app/api/stripe/webhook/route.ts"])("%s reaches no contract code", (entry) => {
    const reached = reachedFiles(entry);
    expect(reached).toContain("lib/orders/notify.ts");
    expect(reached.filter((file) => /(^|\/)contracts\//.test(file))).toEqual([]);
  });
});
