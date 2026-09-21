import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/lib/db/queries";
import type { ServiceDocRow, UserDocumentRow, UserServiceRow } from "@/lib/db/types";

/**
 * The order emails against a fake database and a spied sender. No network:
 * the sender, the admin client and the request headers are replaced with
 * vi.mock before the module under test loads.
 */

const { tables, sendEmail, requestHeaders, failing } = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  sendEmail: vi.fn(),
  requestHeaders: { value: null as Headers | null },
  /** A table name here answers every read with an error. */
  failing: new Set<string>(),
}));

vi.mock("@/lib/email/send", () => ({ sendEmail }));

vi.mock("next/headers", () => ({
  headers: async () => {
    if (!requestHeaders.value) throw new Error("headers() was called outside a request scope");
    return requestHeaders.value;
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const filters: [string, unknown][] = [];
      const run = () => {
        if (failing.has(table)) return { data: null, error: { message: `${table} is down` } };
        const rows = (tables[table] ?? []).filter((row) => filters.every(([c, v]) => row[c] === v));
        return { data: rows.map((r) => ({ ...r })), error: null };
      };
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return query;
        },
        order() {
          return query;
        },
        maybeSingle() {
          const r = run();
          return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error });
        },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return query;
    },
  }),
}));

import { completesDossier, notifyDocumentsReady, notifyOrderPaid, notifyPaymentMismatch } from "./notify";

const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const SERVICE_ID = "44444444-4444-4444-8444-444444444444";
const ORIGIN = "http://localhost:3000";
const TEAM = "team@example.com";

const PASSPORT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADDRESS = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EXTRA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const order: UserServiceRow = {
  id: ORDER_ID,
  user_id: OWNER_ID,
  service_id: SERVICE_ID,
  submission_id: null,
  answers_snapshot: {},
  joint: false,
  applicants: 1,
  total_cents: 49700,
  currency: "eur",
  stage_key: "documents",
  stripe_checkout_session_id: "cs_test_1",
  stripe_payment_intent_id: "pi_test_1",
  paid_at: "2026-09-21T09:00:00.000Z",
  completed_at: null,
  report: null,
  created_at: "2026-09-21T08:55:00.000Z",
  updated_at: "2026-09-21T09:00:00.000Z",
};

function slot(id: string, position: number, overrides: Partial<ServiceDocRow> = {}): ServiceDocRow {
  return {
    id,
    service_id: SERVICE_ID,
    key: `doc_${position}`,
    label: `Document ${position}`,
    note: null,
    accepted_mime: ["application/pdf"],
    max_bytes: 10_000_000,
    per_applicant: false,
    required: true,
    position,
    template: null,
    ...overrides,
  };
}

let clock = 0;

/** One upload attempt; each new row is newer than the last. */
function upload(serviceDocId: string, status: UserDocumentRow["status"], applicantIndex: 0 | 1 = 0): UserDocumentRow {
  clock++;
  const at = new Date(Date.UTC(2026, 8, 21, 10, 0, clock)).toISOString();
  return {
    id: crypto.randomUUID(),
    user_service_id: ORDER_ID,
    service_doc_id: serviceDocId,
    applicant_index: applicantIndex,
    storage_key: `orders/${ORDER_ID}/${serviceDocId}/${applicantIndex}/${clock}.pdf`,
    file_name: "file.pdf",
    mime_type: "application/pdf",
    size_bytes: 1234,
    status,
    rejection_reason: status === "rejected" ? "Blurry." : null,
    uploaded_at: status === "pending" ? null : at,
    reviewed_at: null,
    reviewed_by: null,
    created_at: at,
    updated_at: at,
  };
}

function seed(input: { docs: ServiceDocRow[]; documents?: UserDocumentRow[]; template?: string | null }) {
  const template = input.template === undefined ? "package" : input.template;
  tables.services = [{ id: SERVICE_ID, name: "NIF + Bank Account", contract_template: template }];
  tables.users = [{ id: OWNER_ID, email: "client@example.com" }];
  tables.service_docs = input.docs;
  tables.user_documents = input.documents ?? [];
}

/** The sent emails, by recipient. */
function sentTo(to: string) {
  return sendEmail.mock.calls.map((call) => call[0]).filter((email) => email.to === to);
}

let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true, id: "email_1" });
  for (const key of Object.keys(tables)) delete tables[key];
  failing.clear();
  requestHeaders.value = null;
  vi.stubEnv("EMAIL_TEAM_INBOX", TEAM);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  warn.mockRestore();
  error.mockRestore();
});

describe("notifyOrderPaid", () => {
  it("sends the client Payment received and the team New paid order", async () => {
    seed({ docs: [] });

    const result = await notifyOrderPaid(order, { origin: ORIGIN });

    expect(result).toEqual({ client: true, team: true });
    expect(sendEmail).toHaveBeenCalledTimes(2);

    const [client] = sentTo("client@example.com");
    expect(client.subject).toBe("Payment received for your NIF + Bank Account order");
    expect(client.text).toContain("Next, confirm your details for the service agreement, then upload your documents.");
    expect(client.text).toContain(`${ORIGIN}/en/dashboard/orders/${ORDER_ID}`);

    const [team] = sentTo(TEAM);
    expect(team.subject).toBe("New paid order: NIF + Bank Account, €497");
    expect(team.text).toContain("Client: client@example.com");
    expect(team.text).toContain(`${ORIGIN}/admin/orders?order=${ORDER_ID}`);
  });

  it("goes straight to the documents when the service has no agreement", async () => {
    seed({ docs: [], template: null });

    await notifyOrderPaid(order, { origin: ORIGIN });

    const [client] = sentTo("client@example.com");
    expect(client.text).toContain("Next, upload your documents.");
    expect(client.text).not.toContain("service agreement");
  });

  it("skips the team email with one log line when EMAIL_TEAM_INBOX is not set", async () => {
    vi.stubEnv("EMAIL_TEAM_INBOX", "");
    seed({ docs: [] });

    const result = await notifyOrderPaid(order, { origin: ORIGIN });

    expect(result).toEqual({ client: true, team: false });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe("client@example.com");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("EMAIL_TEAM_INBOX not set");
  });

  it("builds the links on the current request when no origin is given", async () => {
    seed({ docs: [] });
    requestHeaders.value = new Headers({ host: "localhost:3000" });

    await notifyOrderPaid(order);

    expect(sentTo("client@example.com")[0].text).toContain(`http://localhost:3000/en/dashboard/orders/${ORDER_ID}`);
  });

  it("prefers the site URL over any origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
    seed({ docs: [] });

    await notifyOrderPaid(order, { origin: ORIGIN });

    expect(sentTo(TEAM)[0].text).toContain(`https://example.com/admin/orders?order=${ORDER_ID}`);
  });

  it("still tells the team when the owner has no email on record", async () => {
    seed({ docs: [] });
    tables.users = [];

    const result = await notifyOrderPaid(order, { origin: ORIGIN });

    expect(result).toEqual({ client: false, team: true });
    expect(sentTo(TEAM)[0].text).toContain("Client: Not on record");
  });

  it("never throws: a database that fails or a sender that throws answers false", async () => {
    seed({ docs: [] });
    failing.add("services");
    failing.add("users");
    sendEmail.mockRejectedValue(new Error("socket hang up"));

    await expect(notifyOrderPaid(order, { origin: ORIGIN })).resolves.toEqual({ client: false, team: false });
  });

  it("never throws when the database client cannot even be created", async () => {
    const db = {
      from() {
        throw new Error("SUPABASE_SECRET_KEY is not set");
      },
    };

    await expect(notifyOrderPaid(order, { origin: ORIGIN, db: db as unknown as Db })).resolves.toEqual({
      client: false,
      team: false,
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("notifyPaymentMismatch", () => {
  const unpaid = { ...order, paid_at: null, stage_key: "awaiting_payment", total_cents: 14900 };
  const mismatch = { order: unpaid, sessionId: "cs_live_a1B2c3", paidCents: 49700, paidCurrency: "eur" };

  it("tells the team what was paid against what the order expects, and nobody else", async () => {
    seed({ docs: [] });

    const sent = await notifyPaymentMismatch(mismatch, { origin: ORIGIN });

    expect(sent).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const email = sendEmail.mock.calls[0][0];
    expect(email.to).toBe(TEAM);
    expect(email.subject).toBe("Paid amount does not match the order: NIF + Bank Account, client@example.com");
    expect(email.text).toContain("Paid: €497");
    expect(email.text).toContain("Order total: €149");
    expect(email.text).toContain("Stripe session: cs_live_a1B2c3");
    expect(email.text).toContain(`${ORIGIN}/admin/orders?order=${ORDER_ID}`);
  });

  it("says so when Stripe states no amount", async () => {
    seed({ docs: [] });

    await notifyPaymentMismatch({ ...mismatch, paidCents: null }, { origin: ORIGIN });

    expect(sendEmail.mock.calls[0][0].text).toContain("Paid: Not stated");
  });

  it("skips with one log line when EMAIL_TEAM_INBOX is not set", async () => {
    vi.stubEnv("EMAIL_TEAM_INBOX", "");
    seed({ docs: [] });

    expect(await notifyPaymentMismatch(mismatch, { origin: ORIGIN })).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("never throws when the sender does", async () => {
    seed({ docs: [] });
    sendEmail.mockRejectedValue(new Error("socket hang up"));

    await expect(notifyPaymentMismatch(mismatch, { origin: ORIGIN })).resolves.toBe(false);
  });
});

describe("completesDossier", () => {
  const docs = [slot(PASSPORT, 1, { per_applicant: true }), slot(ADDRESS, 2), slot(EXTRA, 3, { required: false })];

  it("is false while a required slot is still empty", () => {
    const passport = upload(PASSPORT, "uploaded");
    expect(completesDossier(docs, [passport], 1, passport)).toBe(false);
  });

  it("is true when the confirmed upload fills the last required slot", () => {
    const passport = upload(PASSPORT, "approved");
    const address = upload(ADDRESS, "uploaded");
    expect(completesDossier(docs, [passport, address], 1, address)).toBe(true);
  });

  it("is false for an optional slot filled after the set was complete", () => {
    const rows = [upload(PASSPORT, "uploaded"), upload(ADDRESS, "uploaded")];
    const extra = upload(EXTRA, "uploaded");
    expect(completesDossier(docs, [...rows, extra], 1, extra)).toBe(false);
  });

  it("counts a per applicant slot once for each person of a couple", () => {
    const first = upload(PASSPORT, "uploaded", 0);
    const address = upload(ADDRESS, "uploaded");
    expect(completesDossier(docs, [first, address], 2, address)).toBe(false);

    const second = upload(PASSPORT, "uploaded", 1);
    expect(completesDossier(docs, [first, address, second], 2, second)).toBe(true);
  });

  it("is false while a rejected file waits to be replaced", () => {
    const passport = upload(PASSPORT, "rejected");
    const address = upload(ADDRESS, "uploaded");
    expect(completesDossier(docs, [passport, address], 1, address)).toBe(false);
  });

  it("ignores a second applicant on a single person order", () => {
    const rows = [upload(PASSPORT, "uploaded"), upload(ADDRESS, "uploaded")];
    const stray = upload(PASSPORT, "uploaded", 1);
    expect(completesDossier(docs, [...rows, stray], 1, stray)).toBe(false);
  });

  it("is false for a service that asks for no required document", () => {
    const extra = upload(EXTRA, "uploaded");
    expect(completesDossier([slot(EXTRA, 1, { required: false })], [extra], 1, extra)).toBe(false);
  });
});

describe("notifyDocumentsReady", () => {
  const docs = [slot(PASSPORT, 1, { per_applicant: true }), slot(ADDRESS, 2), slot(EXTRA, 3, { required: false })];

  it("sends nothing while a required slot is still empty", async () => {
    const passport = upload(PASSPORT, "uploaded");
    seed({ docs, documents: [passport] });

    const sent = await notifyDocumentsReady({ order, document: passport }, { origin: ORIGIN });

    expect(sent).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("emails the team once the last required slot is filled", async () => {
    const passport = upload(PASSPORT, "approved");
    const address = upload(ADDRESS, "uploaded");
    seed({ docs, documents: [passport, address] });

    const sent = await notifyDocumentsReady({ order, document: address }, { origin: ORIGIN });

    expect(sent).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const email = sendEmail.mock.calls[0][0];
    expect(email.to).toBe(TEAM);
    expect(email.subject).toBe("Documents ready to review: NIF + Bank Account, client@example.com");
    expect(email.text).toContain("To review: 1 file");
    expect(email.text).toContain(`${ORIGIN}/admin/orders?order=${ORDER_ID}`);
  });

  it("sends again when a replaced file completes the set after a rejection", async () => {
    const rejected = upload(PASSPORT, "rejected");
    const address = upload(ADDRESS, "uploaded");
    const replacement = upload(PASSPORT, "uploaded");
    seed({ docs, documents: [rejected, address, replacement] });

    const sent = await notifyDocumentsReady({ order, document: replacement }, { origin: ORIGIN });

    expect(sent).toBe(true);
    expect(sendEmail.mock.calls[0][0].text).toContain("To review: 2 files");
  });

  it("sends nothing for an optional upload after the set was complete", async () => {
    const extra = upload(EXTRA, "uploaded");
    seed({ docs, documents: [upload(PASSPORT, "uploaded"), upload(ADDRESS, "uploaded"), extra] });

    expect(await notifyDocumentsReady({ order, document: extra }, { origin: ORIGIN })).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("skips with one log line when EMAIL_TEAM_INBOX is not set", async () => {
    vi.stubEnv("EMAIL_TEAM_INBOX", "");
    const address = upload(ADDRESS, "uploaded");
    seed({ docs, documents: [upload(PASSPORT, "uploaded"), address] });

    const sent = await notifyDocumentsReady({ order, document: address }, { origin: ORIGIN });

    expect(sent).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("EMAIL_TEAM_INBOX not set");
  });

  it("never throws when the database fails", async () => {
    const address = upload(ADDRESS, "uploaded");
    seed({ docs, documents: [address] });
    failing.add("user_documents");

    await expect(notifyDocumentsReady({ order, document: address }, { origin: ORIGIN })).resolves.toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("never throws when the sender does", async () => {
    const address = upload(ADDRESS, "uploaded");
    seed({ docs, documents: [upload(PASSPORT, "uploaded"), address] });
    sendEmail.mockRejectedValue(new Error("socket hang up"));

    await expect(notifyDocumentsReady({ order, document: address }, { origin: ORIGIN })).resolves.toBe(false);
  });
});
