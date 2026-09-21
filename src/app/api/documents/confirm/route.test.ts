import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceDocRow, UserDocumentRow, UserServiceRow } from "@/lib/db/types";

/**
 * POST /api/documents/confirm with the real notifyDocumentsReady behind it,
 * against a fake database and stand ins for everything that leaves the
 * process: the session, the bucket and the email sender.
 */

type Row = Record<string, unknown>;

const { tables, session, headObjectSize, sendEmail } = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  session: { user: null as { id: string; email: string } | null },
  headObjectSize: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/user", () => ({ getUser: async () => session.user }));
vi.mock("@/lib/r2/client", () => ({ headObjectSize }));
vi.mock("@/lib/email/send", () => ({ sendEmail }));
vi.mock("next/headers", () => ({
  headers: async () => {
    throw new Error("headers() was called outside a request scope");
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const filters: [string, unknown][] = [];
      let op: "select" | "update" = "select";
      let payload: Row = {};
      const rows = () => (tables[table] ??= []);
      const matching = () => rows().filter((row) => filters.every(([c, v]) => row[c] === v));
      const run = () => {
        const hit = matching();
        if (op === "update") for (const row of hit) Object.assign(row, payload);
        return { data: hit.map((r) => ({ ...r })), error: null };
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
        update(values: Row) {
          op = "update";
          payload = values;
          return query;
        },
        maybeSingle() {
          return Promise.resolve({ data: run().data[0] ?? null, error: null });
        },
        single() {
          const data = run().data[0] ?? null;
          return Promise.resolve({ data, error: data ? null : { message: "no row" } });
        },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return query;
    },
  }),
}));

import { POST } from "./route";

const OWNER = { id: "11111111-1111-4111-8111-111111111111", email: "client@example.com" };
const STRANGER = { id: "22222222-2222-4222-8222-222222222222", email: "other@example.com" };
const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const SERVICE_ID = "44444444-4444-4444-8444-444444444444";
const PASSPORT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADDRESS = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TEAM = "team@example.com";
const BASE = "http://localhost:3000";

const order: UserServiceRow = {
  id: ORDER_ID,
  user_id: OWNER.id,
  service_id: SERVICE_ID,
  submission_id: null,
  answers_snapshot: {},
  joint: false,
  applicants: 1,
  total_cents: 14900,
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

function slot(id: string, position: number): ServiceDocRow {
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
  };
}

function upload(id: string, serviceDocId: string, status: UserDocumentRow["status"], second: number): UserDocumentRow {
  const at = new Date(Date.UTC(2026, 8, 21, 10, 0, second)).toISOString();
  return {
    id,
    user_service_id: ORDER_ID,
    service_doc_id: serviceDocId,
    applicant_index: 0,
    storage_key: `orders/${ORDER_ID}/${serviceDocId}/0/${id}.pdf`,
    file_name: "file.pdf",
    mime_type: "application/pdf",
    size_bytes: 1234,
    status,
    rejection_reason: null,
    uploaded_at: status === "pending" ? null : at,
    reviewed_at: null,
    reviewed_by: null,
    created_at: at,
    updated_at: at,
  };
}

const PASSPORT_DOC = "66666666-6666-4666-8666-666666666666";
const ADDRESS_DOC = "77777777-7777-4777-8777-777777777777";

function seed(documents: UserDocumentRow[]) {
  tables.user_services = [{ ...order }];
  tables.services = [{ id: SERVICE_ID, name: "NIF only", contract_template: "nif" }];
  tables.users = [{ id: OWNER.id, email: OWNER.email }];
  tables.service_docs = [slot(PASSPORT, 1), slot(ADDRESS, 2)];
  tables.user_documents = documents.map((row) => ({ ...row }));
}

function confirm(documentId: string) {
  return POST(
    new Request(`${BASE}/api/documents/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({ documentId }),
    }),
  );
}

function stored(id: string) {
  return tables.user_documents.find((row) => row.id === id) as unknown as UserDocumentRow;
}

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  session.user = OWNER;
  headObjectSize.mockReset();
  headObjectSize.mockResolvedValue(1234);
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true, id: "email_1" });
  vi.stubEnv("EMAIL_TEAM_INBOX", TEAM);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  logged.mockRestore();
});

describe("POST /api/documents/confirm", () => {
  it("records an upload that leaves a required slot empty and sends nothing", async () => {
    seed([upload(PASSPORT_DOC, PASSPORT, "pending", 1)]);

    const res = await confirm(PASSPORT_DOC);

    expect(res.status).toBe(200);
    expect(stored(PASSPORT_DOC).status).toBe("uploaded");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("emails the team once the last required slot is filled", async () => {
    seed([upload(PASSPORT_DOC, PASSPORT, "approved", 1), upload(ADDRESS_DOC, ADDRESS, "pending", 2)]);

    const res = await confirm(ADDRESS_DOC);

    expect(res.status).toBe(200);
    expect(stored(ADDRESS_DOC).status).toBe("uploaded");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const email = sendEmail.mock.calls[0][0];
    expect(email.to).toBe(TEAM);
    expect(email.subject).toBe("Documents ready to review: NIF only, client@example.com");
    expect(email.text).toContain(`${BASE}/admin/orders?order=${ORDER_ID}`);
  });

  it("sends nothing on a retried confirm of an upload already recorded", async () => {
    seed([upload(PASSPORT_DOC, PASSPORT, "uploaded", 1), upload(ADDRESS_DOC, ADDRESS, "uploaded", 2)]);

    const res = await confirm(ADDRESS_DOC);

    expect(res.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("keeps the upload when the email fails", async () => {
    seed([upload(PASSPORT_DOC, PASSPORT, "uploaded", 1), upload(ADDRESS_DOC, ADDRESS, "pending", 2)]);
    sendEmail.mockRejectedValue(new Error("socket hang up"));

    const res = await confirm(ADDRESS_DOC);

    expect(res.status).toBe(200);
    expect(((await res.json()) as { document: UserDocumentRow }).document.status).toBe("uploaded");
    expect(stored(ADDRESS_DOC).status).toBe("uploaded");
  });

  it("skips the email without EMAIL_TEAM_INBOX and still records the upload", async () => {
    vi.stubEnv("EMAIL_TEAM_INBOX", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    seed([upload(PASSPORT_DOC, PASSPORT, "uploaded", 1), upload(ADDRESS_DOC, ADDRESS, "pending", 2)]);

    const res = await confirm(ADDRESS_DOC);

    expect(res.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("refuses a stranger's document and sends nothing", async () => {
    session.user = STRANGER;
    seed([upload(PASSPORT_DOC, PASSPORT, "uploaded", 1), upload(ADDRESS_DOC, ADDRESS, "pending", 2)]);

    const res = await confirm(ADDRESS_DOC);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "This order is not yours." });
    expect(stored(ADDRESS_DOC).status).toBe("pending");
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
