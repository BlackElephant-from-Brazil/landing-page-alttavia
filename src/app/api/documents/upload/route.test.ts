import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceDocRow, UserDocumentRow, UserServiceRow } from "@/lib/db/types";

/**
 * POST /api/documents/upload, the same origin fallback, against a fake
 * database and stand ins for the session, the bucket and the email sender.
 * It is the route that saves an upload when the browser's PUT to the bucket
 * never arrives, so what is under test is that it writes only what the
 * pending row promised and then finishes the row exactly as /confirm does.
 */

type Row = Record<string, unknown>;

const { tables, session, putObject, headObjectSize, deleteObject, sendEmail } = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  session: { user: null as { id: string; email: string } | null },
  putObject: vi.fn(),
  headObjectSize: vi.fn(),
  deleteObject: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/user", () => ({ getUser: async () => session.user }));
vi.mock("@/lib/r2/client", () => ({ putObject, headObjectSize, deleteObject }));
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
const DOC_ID = "66666666-6666-4666-8666-666666666666";
const FILE_ID = "77777777-7777-4777-8777-777777777777";
const KEY = `orders/${ORDER_ID}/address/0/file.png`;
const SIZE = 2048;
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

const doc: ServiceDocRow = {
  id: DOC_ID,
  service_id: SERVICE_ID,
  key: "address",
  label: "Proof of address",
  note: null,
  accepted_mime: ["image/png"],
  max_bytes: 10_000_000,
  per_applicant: false,
  required: true,
  position: 1,
  template: null,
};

function file(status: UserDocumentRow["status"], sizeBytes = SIZE): Row {
  return {
    id: FILE_ID,
    user_service_id: ORDER_ID,
    service_doc_id: DOC_ID,
    applicant_index: 0,
    storage_key: KEY,
    file_name: "proof of address.png",
    mime_type: "image/png",
    size_bytes: sizeBytes,
    status,
    rejection_reason: null,
    uploaded_at: null,
    reviewed_at: null,
    reviewed_by: null,
    created_at: "2026-09-21T10:00:00.000Z",
    updated_at: "2026-09-21T10:00:00.000Z",
  };
}

function seed(row: Row = file("pending")) {
  tables.user_services = [{ ...order }];
  tables.services = [{ id: SERVICE_ID, name: "NIF only", contract_template: "nif" }];
  tables.users = [{ id: OWNER.id, email: OWNER.email }];
  tables.service_docs = [{ ...doc }];
  tables.user_documents = [row];
}

/**
 * The browser sends a Blob through XMLHttpRequest, which always declares its
 * length, so every probe here does the same. `length: null` is the request
 * that declares none, which the route has to refuse before it reads a byte.
 */
function send(bytes: Uint8Array, type = "image/png", id: string = FILE_ID, length: number | null = bytes.byteLength) {
  const headers: Record<string, string> = { "content-type": type, origin: BASE };
  if (length !== null) headers["content-length"] = String(length);
  return POST(
    new Request(`${BASE}/api/documents/upload?documentId=${id}`, {
      method: "POST",
      headers,
      body: bytes.buffer as ArrayBuffer,
    }),
  );
}

async function errorOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: string }).error;
}

function stored(): UserDocumentRow {
  return tables.user_documents[0] as unknown as UserDocumentRow;
}

const BYTES = new Uint8Array(SIZE).fill(7);

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  session.user = OWNER;
  putObject.mockReset();
  putObject.mockResolvedValue(undefined);
  headObjectSize.mockReset();
  headObjectSize.mockResolvedValue(SIZE);
  deleteObject.mockReset();
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true, id: "email_1" });
  vi.stubEnv("EMAIL_TEAM_INBOX", "team@example.com");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  logged.mockRestore();
});

describe("POST /api/documents/upload", () => {
  it("writes the bytes under the row's own key and records the upload", async () => {
    seed();

    const response = await send(BYTES);

    expect(response.status).toBe(200);
    expect(putObject).toHaveBeenCalledWith({ key: KEY, body: expect.any(Uint8Array), contentType: "image/png" });
    expect(putObject.mock.calls[0][0].body.byteLength).toBe(SIZE);
    expect(stored().status).toBe("uploaded");
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("refuses a body that is not the length the row promised", async () => {
    seed();

    const response = await send(new Uint8Array(SIZE - 1));

    expect(response.status).toBe(422);
    expect(await errorOf(response)).toBe("This file did not arrive whole. Try again.");
    expect(putObject).not.toHaveBeenCalled();
    expect(stored().status).toBe("pending");
  });

  it("refuses a body that does not say how long it is, before reading it", async () => {
    seed();

    const response = await send(BYTES, "image/png", FILE_ID, null);

    expect(response.status).toBe(411);
    expect(await errorOf(response)).toBe("This file did not arrive whole. Try again.");
    expect(putObject).not.toHaveBeenCalled();
    expect(stored().status).toBe("pending");
  });

  it("refuses a type that is not the row's", async () => {
    seed();

    const response = await send(BYTES, "application/pdf");

    expect(response.status).toBe(415);
    expect(await errorOf(response)).toBe("This file type does not match the one we expected.");
    expect(putObject).not.toHaveBeenCalled();
  });

  it("refuses a file too big to come this way and says what to do", async () => {
    seed(file("pending", 5_000_000));

    const response = await send(BYTES);

    expect(response.status).toBe(413);
    expect(await errorOf(response)).toBe("This file is too big to send this way. Compress it to under 4 MB and try again.");
    expect(putObject).not.toHaveBeenCalled();
  });

  it("answers the row and writes nothing when the upload already arrived", async () => {
    seed(file("uploaded"));

    const response = await send(BYTES);

    expect(response.status).toBe(200);
    expect(putObject).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("refuses a reviewed row", async () => {
    seed(file("approved"));

    const response = await send(BYTES);

    expect(response.status).toBe(409);
    expect(await errorOf(response)).toBe("This file has already been reviewed.");
    expect(putObject).not.toHaveBeenCalled();
  });

  it("refuses a stranger and writes nothing", async () => {
    session.user = STRANGER;
    seed();

    const response = await send(BYTES);

    expect(response.status).toBe(403);
    expect(await errorOf(response)).toBe("This order is not yours.");
    expect(putObject).not.toHaveBeenCalled();
    expect(stored().status).toBe("pending");
  });

  it("refuses a malformed id", async () => {
    seed();

    const response = await send(BYTES, "image/png", "nope");

    expect(response.status).toBe(400);
    expect(putObject).not.toHaveBeenCalled();
  });

  it("keeps the row pending when the bucket did not take the bytes", async () => {
    seed();
    headObjectSize.mockResolvedValue(null);

    const response = await send(BYTES);

    expect(response.status).toBe(422);
    expect(await errorOf(response)).toBe("Upload incomplete.");
    expect(stored().status).toBe("pending");
  });
});
