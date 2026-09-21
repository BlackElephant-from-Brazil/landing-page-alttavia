import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST and PATCH /api/admin/feedback with the real email template and the
 * real error answers behind them, against a fake database and stand ins for
 * what leaves the process: the session and the email sender.
 *
 * Only requireAdmin() is replaced (by one that reads `session` and throws
 * the real AdminAuthError); how it decides who is an admin is tested with
 * src/lib/supabase/admin-user.ts, not here.
 */

type Row = Record<string, unknown>;

const { tables, session, sendEmail, failNextWrite } = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  session: { user: null as { id: string; email: string; role: "client" | "admin" } | null },
  sendEmail: vi.fn(),
  failNextWrite: { value: false },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email/send", () => ({ sendEmail }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/supabase/admin-user", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/admin-user")>();
  return {
    ...actual,
    requireAdmin: async () => {
      if (!session.user) throw new actual.AdminAuthError(401);
      if (session.user.role !== "admin") throw new actual.AdminAuthError(403);
      return { id: session.user.id, email: session.user.email, role: "admin" as const };
    },
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const filters: [string, unknown][] = [];
      let op: "select" | "insert" | "update" = "select";
      let payload: Row = {};
      const rows = () => (tables[table] ??= []);
      const run = (): { data: Row[]; error: { message: string } | null } => {
        if (op !== "select" && failNextWrite.value) {
          failNextWrite.value = false;
          return { data: [], error: { message: "relation does not exist" } };
        }
        if (op === "insert") {
          const now = "2026-09-22T09:15:00.000Z";
          const row: Row = { id: crypto.randomUUID(), status: "open", created_at: now, updated_at: now, ...payload };
          rows().push(row);
          return { data: [{ ...row }], error: null };
        }
        const hit = rows().filter((row) => filters.every(([c, v]) => row[c] === v));
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
        insert(values: Row) {
          op = "insert";
          payload = values;
          return query;
        },
        update(values: Row) {
          op = "update";
          payload = values;
          return query;
        },
        async single() {
          const { data, error } = run();
          return { data: data[0] ?? null, error };
        },
        async maybeSingle() {
          const { data, error } = run();
          return { data: data[0] ?? null, error };
        },
      };
      return query;
    },
  }),
}));

import { PATCH, POST } from "./route";

const BASE = "http://localhost:3000";
const ADMIN = { id: "55555555-5555-4555-8555-555555555555", email: "info@alttavia-relocation.com", role: "admin" as const };
const CLIENT = { id: "11111111-1111-4111-8111-111111111111", email: "client@example.com", role: "client" as const };
const NOTE_ID = "99999999-9999-4999-8999-999999999999";

function request(method: "POST" | "PATCH", body: unknown) {
  return new Request(`${BASE}/api/admin/feedback`, {
    method,
    headers: { "content-type": "application/json", origin: BASE },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const post = (body: unknown) => POST(request("POST", body));
const patch = (body: unknown) => PATCH(request("PATCH", body));

async function errorOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: string }).error;
}

let logged: ReturnType<typeof vi.spyOn>;
let info: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  tables.admin_feedback = [];
  session.user = ADMIN;
  failNextWrite.value = false;
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true, id: "email_1" });
  vi.stubEnv("FEEDBACK_TO", "business@guyshore.com");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
  info = vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/admin/feedback", () => {
  it("saves the note for the signed in admin, answers 201 with its id and emails FEEDBACK_TO", async () => {
    const response = await post({
      pageUrl: "  /admin/orders?order=abc  ",
      expected: "  The stage moves forward.  ",
      happened: "Nothing moved.",
      priority: "blocks",
    });

    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    expect(tables.admin_feedback).toHaveLength(1);
    expect(tables.admin_feedback[0]).toMatchObject({
      id,
      user_id: ADMIN.id,
      page_url: "/admin/orders?order=abc",
      expected: "The stage moves forward.",
      happened: "Nothing moved.",
      priority: "blocks",
      status: "open",
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const email = sendEmail.mock.calls[0][0] as { to: string; subject: string; html: string; text: string };
    expect(email.to).toBe("business@guyshore.com");
    expect(email.subject).toBe("Admin feedback: Blocks my work on /admin/orders?order=abc");
    expect(email.text).toContain(`Screen: ${BASE}/admin/orders?order=abc`);
    expect(email.text).toContain(`Sent by: ${ADMIN.email}`);
    expect(email.text).toContain(`See every note: ${BASE}/admin/feedback`);
  });

  it("takes a note with only one of the two answers", async () => {
    expect((await post({ expected: "A clearer label.", priority: "nice_to_have" })).status).toBe(201);
    expect((await post({ happened: "The page went blank.", expected: "   ", priority: "should_change" })).status).toBe(201);

    expect(tables.admin_feedback.map((row) => [row.expected, row.happened, row.page_url])).toEqual([
      ["A clearer label.", null, null],
      [null, "The page went blank.", null],
    ]);
  });

  it("refuses a note with neither answer: 422, nothing saved, nothing sent", async () => {
    for (const body of [
      { priority: "blocks" },
      { expected: "", happened: "  ", priority: "blocks" },
      { expected: null, happened: null, pageUrl: "/admin", priority: "blocks" },
    ]) {
      const response = await post(body);
      expect(response.status).toBe(422);
      expect(await errorOf(response)).toBe("Tell us what you expected or what happened.");
    }
    expect(tables.admin_feedback).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("allows 2000 characters per answer and 500 for the screen, and refuses one more", async () => {
    const atLimit = await post({ expected: "e".repeat(2000), happened: "h".repeat(2000), pageUrl: `/${"p".repeat(499)}`, priority: "blocks" });
    expect(atLimit.status).toBe(201);

    const expectedTooLong = await post({ expected: "e".repeat(2001), priority: "blocks" });
    expect(expectedTooLong.status).toBe(422);
    expect(await errorOf(expectedTooLong)).toBe("Keep each answer under 2000 characters.");

    const happenedTooLong = await post({ expected: "ok", happened: "h".repeat(2001), priority: "blocks" });
    expect(happenedTooLong.status).toBe(422);

    const pageTooLong = await post({ expected: "ok", pageUrl: `/${"p".repeat(500)}`, priority: "blocks" });
    expect(pageTooLong.status).toBe(422);
    expect(await errorOf(pageTooLong)).toBe("Keep the screen under 500 characters.");

    expect(tables.admin_feedback).toHaveLength(1);
  });

  it("counts the length after trimming", async () => {
    const response = await post({ expected: `  ${"e".repeat(2000)}  `, priority: "blocks" });
    expect(response.status).toBe(201);
  });

  it("refuses a missing or unknown priority with 422", async () => {
    for (const priority of [undefined, "", "urgent", 1, null]) {
      const response = await post({ expected: "Something.", priority });
      expect(response.status).toBe(422);
      expect(await errorOf(response)).toBe("Choose how much it matters.");
    }
    expect(tables.admin_feedback).toHaveLength(0);
  });

  it("refuses a body of the wrong shape with 400", async () => {
    for (const body of ["{", "[]", '"text"', "null", { expected: 42, priority: "blocks" }, { pageUrl: ["/admin"], expected: "x", priority: "blocks" }]) {
      const response = await post(body);
      expect(response.status).toBe(400);
      expect(await errorOf(response)).toBe("Check the details and try again.");
    }
    expect(tables.admin_feedback).toHaveLength(0);
  });

  it("drops control characters, keeping line breaks in the answers only", async () => {
    const nul = String.fromCharCode(0);
    const response = await post({
      pageUrl: `/admin/users${String.fromCharCode(10)}?q=a${nul}`,
      expected: `First line.\r\nSecond line.${nul}`,
      happened: `Tab\there.${String.fromCharCode(27)}`,
      priority: "should_change",
    });

    expect(response.status).toBe(201);
    expect(tables.admin_feedback[0]).toMatchObject({
      page_url: "/admin/users?q=a",
      expected: "First line.\nSecond line.",
      happened: "Tab\there.",
    });
  });

  it("escapes what was typed in the email's HTML and links only a path on this site", async () => {
    await post({ pageUrl: "//evil.example/x", expected: "<script>alert(1)</script>", priority: "blocks" });

    const email = sendEmail.mock.calls[0][0] as { html: string; text: string };
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain('href="http://localhost:3000//evil.example/x"');
    expect(email.text).toContain("Screen: //evil.example/x");
  });

  it("still saves and answers 201 when FEEDBACK_TO is not set, with one log line", async () => {
    vi.stubEnv("FEEDBACK_TO", "");

    const response = await post({ expected: "Saved anyway.", priority: "nice_to_have" });

    expect(response.status).toBe(201);
    expect(tables.admin_feedback).toHaveLength(1);
    expect(sendEmail).not.toHaveBeenCalled();
    const lines = info.mock.calls.map((call) => String(call[0])).filter((line) => line.startsWith("feedback:"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("FEEDBACK_TO not set");
  });

  it("still answers 201 when the email fails or throws", async () => {
    sendEmail.mockResolvedValueOnce({ ok: false });
    expect((await post({ expected: "One.", priority: "blocks" })).status).toBe(201);

    sendEmail.mockRejectedValueOnce(new Error("network down"));
    expect((await post({ expected: "Two.", priority: "blocks" })).status).toBe(201);

    expect(tables.admin_feedback).toHaveLength(2);
    expect(logged).toHaveBeenCalled();
  });

  it("answers 401 signed out and 403 for a client, writing nothing", async () => {
    session.user = null;
    const signedOut = await post({ expected: "x", priority: "blocks" });
    expect(signedOut.status).toBe(401);

    session.user = CLIENT;
    const client = await post({ expected: "x", priority: "blocks" });
    expect(client.status).toBe(403);
    expect(await errorOf(client)).toBe("Not allowed.");

    expect(tables.admin_feedback).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("logs a database failure and answers a generic 500 without sending", async () => {
    failNextWrite.value = true;

    const response = await post({ expected: "x", priority: "blocks" });

    expect(response.status).toBe(500);
    expect(await errorOf(response)).toBe("Something went wrong on our side.");
    expect(logged).toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/feedback", () => {
  beforeEach(() => {
    tables.admin_feedback = [{ id: NOTE_ID, priority: "blocks", status: "open", expected: "x" }];
  });

  it("moves a note to another status", async () => {
    for (const status of ["planned", "done", "wont_do", "open"]) {
      const response = await patch({ id: NOTE_ID, status });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ feedback: { id: NOTE_ID, status } });
      expect(tables.admin_feedback[0].status).toBe(status);
    }
  });

  it("refuses an unknown status with 422", async () => {
    for (const status of [undefined, "closed", "", 3]) {
      const response = await patch({ id: NOTE_ID, status });
      expect(response.status).toBe(422);
      expect(await errorOf(response)).toBe("Choose a status.");
    }
    expect(tables.admin_feedback[0].status).toBe("open");
  });

  it("answers 404 for an id that is not a UUID or not a note", async () => {
    for (const id of [undefined, "nope", "00000000-0000-4000-8000-000000000000"]) {
      const response = await patch({ id, status: "done" });
      expect(response.status).toBe(404);
      expect(await errorOf(response)).toBe("Note not found.");
    }
  });

  it("refuses a body that is not an object with 400", async () => {
    expect((await patch("[]")).status).toBe(400);
  });

  it("answers 401 signed out and 403 for a client, changing nothing", async () => {
    session.user = null;
    expect((await patch({ id: NOTE_ID, status: "done" })).status).toBe(401);

    session.user = CLIENT;
    expect((await patch({ id: NOTE_ID, status: "done" })).status).toBe(403);

    expect(tables.admin_feedback[0].status).toBe("open");
  });
});
