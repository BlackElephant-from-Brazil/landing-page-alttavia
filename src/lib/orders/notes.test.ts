import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * addNote and resolveNote against a fake admin client and a spied email
 * sender, in the same shape as review.test.ts.
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
          const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), resolved_at: null, ...payload };
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
        is(column: string, value: unknown) {
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
        single() {
          const r = run();
          return Promise.resolve(
            r.data[0] ? { data: r.data[0], error: null } : { data: null, error: { message: "no rows" } },
          );
        },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return query;
    },
  }),
}));

import { MAX_NOTE_LENGTH, NoteError, addNote, resolveNote } from "./notes";

const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_ID = "55555555-5555-4555-8555-555555555555";
const NOTE_ID = "88888888-8888-4888-8888-888888888888";

beforeEach(() => {
  writes.length = 0;
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true });
  for (const key of Object.keys(tables)) delete tables[key];
  tables.user_services = [{ id: ORDER_ID, user_id: OWNER_ID }];
  tables.users = [{ id: OWNER_ID, email: "client@example.com" }];
  tables.user_service_notes = [];
});

describe("addNote", () => {
  it("stores a client note and emails the owner", async () => {
    const result = await addNote(ORDER_ID, ADMIN_ID, "client", "  Send page two of the lease.  ", "http://localhost:3000");

    expect(result.note).toMatchObject({
      user_service_id: ORDER_ID,
      author_id: ADMIN_ID,
      audience: "client",
      body: "Send page two of the lease.",
      resolved_at: null,
    });
    expect(result.emailed).toBe(true);
    expect(tables.user_service_notes).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const email = sendEmail.mock.calls[0][0];
    expect(email.to).toBe("client@example.com");
    expect(email.text).toContain("Send page two of the lease.");
    expect(email.text).toContain(`http://localhost:3000/en/dashboard/orders/${ORDER_ID}`);
  });

  it("stores an internal note without emailing anyone", async () => {
    const result = await addNote(ORDER_ID, ADMIN_ID, "internal", "Called Finanças, callback Monday.");

    expect(result.note.audience).toBe("internal");
    expect(result.emailed).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown order and writes nothing", async () => {
    await expect(addNote("00000000-0000-4000-8000-000000000000", ADMIN_ID, "client", "Hello")).rejects.toMatchObject({
      name: "NoteError",
      code: "order_not_found",
      status: 404,
    });
    expect(writes).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("refuses an empty or oversized body", async () => {
    await expect(addNote(ORDER_ID, ADMIN_ID, "client", "   ")).rejects.toMatchObject({ code: "empty_body", status: 422 });
    await expect(addNote(ORDER_ID, ADMIN_ID, "client", "x".repeat(MAX_NOTE_LENGTH + 1))).rejects.toBeInstanceOf(
      NoteError,
    );
    expect(writes).toHaveLength(0);
  });
});

describe("resolveNote", () => {
  it("sets resolved_at once and returns the same row on a second call", async () => {
    tables.user_service_notes = [
      { id: NOTE_ID, user_service_id: ORDER_ID, author_id: ADMIN_ID, audience: "client", body: "Hi", resolved_at: null },
    ];

    const first = await resolveNote(NOTE_ID);
    expect(typeof first.resolved_at).toBe("string");
    expect(writes.filter((w) => w.op === "update")).toHaveLength(1);

    const second = await resolveNote(NOTE_ID);
    expect(second.resolved_at).toBe(first.resolved_at);
    expect(writes.filter((w) => w.op === "update")).toHaveLength(1);
  });

  it("answers 404 for an unknown note", async () => {
    await expect(resolveNote(NOTE_ID)).rejects.toMatchObject({ code: "note_not_found", status: 404 });
  });
});
