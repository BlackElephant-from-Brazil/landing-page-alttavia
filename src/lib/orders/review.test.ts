import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserDocumentRow } from "@/lib/db/types";

/**
 * reviewDocument against a fake admin client and a spied email sender. No
 * network: both are replaced with vi.mock before the module under test
 * loads. The fake answers reads from `tables`, applies updates and inserts
 * to them in place and records every write in `writes`.
 */

const { tables, writes, sendEmail } = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  writes: [] as { table: string; op: "update" | "insert"; payload: Record<string, unknown> }[],
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/email/send", () => ({ sendEmail }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const filters: [string, unknown][] = [];
      let op: "select" | "update" | "insert" = "select";
      let payload: Record<string, unknown> = {};
      const rows = () => (tables[table] ??= []);
      const matching = () => rows().filter((row) => filters.every(([c, v]) => row[c] === v));
      const run = () => {
        if (op === "update") {
          const hit = matching();
          for (const row of hit) Object.assign(row, payload);
          writes.push({ table, op, payload });
          return { data: hit.map((r) => ({ ...r })), error: null };
        }
        if (op === "insert") {
          const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...payload };
          rows().push(row);
          writes.push({ table, op, payload });
          return { data: [{ ...row }], error: null };
        }
        return { data: matching().map((r) => ({ ...r })), error: null };
      };
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return query;
        },
        update(values: Record<string, unknown>) {
          op = "update";
          payload = values;
          return query;
        },
        insert(values: Record<string, unknown>) {
          op = "insert";
          payload = values;
          return query;
        },
        maybeSingle() {
          const r = run();
          return Promise.resolve({ data: r.data[0] ?? null, error: null });
        },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return query;
    },
  }),
}));

import { ReviewError, reviewDocument } from "./review";

const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_ID = "55555555-5555-4555-8555-555555555555";
const DOC_ID = "66666666-6666-4666-8666-666666666666";
const SLOT_ID = "77777777-7777-4777-8777-777777777777";

function document(overrides: Partial<UserDocumentRow> = {}): UserDocumentRow {
  return {
    id: DOC_ID,
    user_service_id: ORDER_ID,
    service_doc_id: SLOT_ID,
    applicant_index: 0,
    storage_key: `orders/${ORDER_ID}/passport/0/abc.pdf`,
    file_name: "passport.pdf",
    mime_type: "application/pdf",
    size_bytes: 1234,
    status: "uploaded",
    rejection_reason: null,
    uploaded_at: "2026-09-11T10:00:00.000Z",
    reviewed_at: null,
    reviewed_by: null,
    created_at: "2026-09-11T09:59:00.000Z",
    updated_at: "2026-09-11T10:00:00.000Z",
    ...overrides,
  };
}

function seed(doc: UserDocumentRow = document()) {
  tables.user_documents = [doc];
  tables.user_services = [{ id: ORDER_ID, user_id: OWNER_ID, stage_key: "documents" }];
  tables.service_docs = [{ id: SLOT_ID, label: "Passport" }];
  tables.users = [{ id: OWNER_ID, email: "client@example.com" }];
  tables.user_service_events = [];
}

function stored() {
  return tables.user_documents[0] as unknown as UserDocumentRow;
}

function events() {
  return tables.user_service_events;
}

beforeEach(() => {
  writes.length = 0;
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true, id: "email_1" });
  for (const key of Object.keys(tables)) delete tables[key];
  seed();
});

describe("reviewDocument", () => {
  it("approves an uploaded document, records the event and sends no email", async () => {
    const result = await reviewDocument(DOC_ID, "approve", null, ADMIN_ID, "http://localhost:3000");

    expect(result.document.status).toBe("approved");
    expect(result.document.reviewed_by).toBe(ADMIN_ID);
    expect(typeof result.document.reviewed_at).toBe("string");
    expect(result.emailed).toBe(false);
    expect(stored().status).toBe("approved");
    expect(events()).toHaveLength(1);
    expect(events()[0]).toMatchObject({
      user_service_id: ORDER_ID,
      from_stage: "documents",
      to_stage: "documents",
      note: "Document approved: Passport",
      actor_id: ADMIN_ID,
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("clears a reason left from an earlier rejection when approving", async () => {
    seed(document({ rejection_reason: "Blurry scan." }));

    const result = await reviewDocument(DOC_ID, "approve", "ignored", ADMIN_ID);

    expect(result.document.rejection_reason).toBeNull();
  });

  it("rejects with a reason, records the event and emails the owner", async () => {
    const result = await reviewDocument(DOC_ID, "reject", "  The scan is cut off.  ", ADMIN_ID, "http://localhost:3000");

    expect(result.document.status).toBe("rejected");
    expect(result.document.rejection_reason).toBe("The scan is cut off.");
    expect(result.emailed).toBe(true);
    expect(events()[0]).toMatchObject({ note: "Document rejected: Passport", to_stage: "documents" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const email = sendEmail.mock.calls[0][0];
    expect(email.to).toBe("client@example.com");
    expect(email.subject).toContain("Passport");
    expect(email.text).toContain("The scan is cut off.");
    expect(email.text).toContain("http://localhost:3000/en/dashboard");
  });

  it("reports a rejection whose email was not accepted", async () => {
    sendEmail.mockResolvedValue({ ok: false });

    const result = await reviewDocument(DOC_ID, "reject", "Wrong document.", ADMIN_ID);

    expect(result.document.status).toBe("rejected");
    expect(result.emailed).toBe(false);
  });

  it("refuses to reject without a reason and writes nothing", async () => {
    await expect(reviewDocument(DOC_ID, "reject", "   ", ADMIN_ID)).rejects.toMatchObject({
      name: "ReviewError",
      code: "reason_required",
      status: 422,
    });
    expect(writes).toHaveLength(0);
    expect(stored().status).toBe("uploaded");
  });

  it("answers 409 for a document that is not waiting for review", async () => {
    seed(document({ status: "approved" }));

    await expect(reviewDocument(DOC_ID, "reject", "Again.", ADMIN_ID)).rejects.toMatchObject({
      code: "not_reviewable",
      status: 409,
    });
    expect(writes).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown document", async () => {
    await expect(
      reviewDocument("00000000-0000-4000-8000-000000000000", "approve", null, ADMIN_ID),
    ).rejects.toBeInstanceOf(ReviewError);
  });

  it("falls back to the file name when the slot has no label", async () => {
    tables.service_docs = [];

    await reviewDocument(DOC_ID, "approve", null, ADMIN_ID);

    expect(events()[0]).toMatchObject({ note: "Document approved: passport.pdf" });
  });
});
