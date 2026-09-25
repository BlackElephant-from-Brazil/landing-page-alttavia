import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UserServiceApplicantRow, UserServiceContractRow } from "@/lib/db/types";

/**
 * The two handlers of /api/orders/[id]/contract with the real ensureContract
 * behind them, against a fake database and stand ins for everything that
 * leaves the process: the session, the bucket, the email sender and the two
 * modules that build the contract's values and its PDF.
 */

type Row = Record<string, unknown>;

const { tables, session, sendEmail, putObject, getObjectBytes, presignDownload, buildContractValues, generateContractPdf } =
  vi.hoisted(() => ({
    tables: {} as Record<string, Record<string, unknown>[]>,
    session: { user: null as { id: string; email: string; role: "client" | "admin" } | null },
    sendEmail: vi.fn(),
    putObject: vi.fn(),
    getObjectBytes: vi.fn(),
    presignDownload: vi.fn(),
    buildContractValues: vi.fn(),
    generateContractPdf: vi.fn(),
  }));

vi.mock("@/lib/supabase/admin-user", () => ({ getUserWithRole: async () => session.user }));
vi.mock("@/lib/email/send", () => ({ sendEmail }));
vi.mock("@/lib/r2/client", () => ({ putObject, getObjectBytes, presignDownload }));
vi.mock("@/content/contracts/variables", () => ({
  buildContractValues,
  contractFileName: () => "service-agreement-nif-jane-alice-doe.pdf",
}));
vi.mock("@/lib/contracts/generate", () => ({ generateContractPdf }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const filters: [string, unknown][] = [];
      let op: "select" | "insert" | "update" = "select";
      let payload: Row = {};
      const rows = () => (tables[table] ??= []);
      const matching = () => rows().filter((row) => filters.every(([c, v]) => row[c] === v));
      const run = () => {
        if (op === "insert") {
          const row: Row = { id: crypto.randomUUID(), emailed_at: null, ...payload };
          rows().push(row);
          return { data: [{ ...row }], error: null };
        }
        if (op === "update") {
          const hit = matching();
          for (const row of hit) Object.assign(row, payload);
          return { data: hit.map((r) => ({ ...r })), error: null };
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
        maybeSingle() {
          return Promise.resolve({ data: run().data[0] ?? null, error: null });
        },
        single() {
          return Promise.resolve({ data: run().data[0] ?? null, error: null });
        },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return query;
    },
  }),
}));

import { GET, POST } from "./route";

const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const STRANGER_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN_ID = "55555555-5555-4555-8555-555555555555";
const SERVICE_ID = "44444444-4444-4444-8444-444444444444";
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";
const BASE = "http://localhost:3000";
const PRESIGNED = "https://r2.example/contracts/signed";

const OWNER = { id: OWNER_ID, email: "client@example.com", role: "client" as const };
const STRANGER = { id: STRANGER_ID, email: "other@example.com", role: "client" as const };
const ADMIN = { id: ADMIN_ID, email: "info@alttavia-relocation.com", role: "admin" as const };

const APPLICANT: Partial<UserServiceApplicantRow> = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  user_service_id: ORDER_ID,
  applicant_index: 0,
  full_name: "Jane Alice Doe",
};

const PARTNER: Partial<UserServiceApplicantRow> = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  user_service_id: ORDER_ID,
  applicant_index: 1,
  full_name: "John Robert Doe",
};

const CONTRACT: Partial<UserServiceContractRow> = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  user_service_id: ORDER_ID,
  template: "nif",
  version: 3,
  storage_key: `contracts/${ORDER_ID}/v3.pdf`,
  file_name: "service-agreement-nif-jane-alice-doe.pdf",
  emailed_at: "2026-09-21T10:21:02.000Z",
};

function ctx(id: string = ORDER_ID) {
  return { params: Promise.resolve({ id }) };
}

function post(body?: string, headers: Record<string, string> = {}, id: string = ORDER_ID) {
  return new Request(`${BASE}/api/orders/${id}/contract`, {
    method: "POST",
    headers: { origin: BASE, ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
    body,
  });
}

function get(query = "", id: string = ORDER_ID) {
  return new Request(`${BASE}/api/orders/${id}/contract${query}`);
}

async function errorOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: string }).error;
}

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  tables.user_services = [
    {
      id: ORDER_ID,
      user_id: OWNER_ID,
      service_id: SERVICE_ID,
      total_cents: 14900,
      paid_at: "2026-09-21T10:15:00.000Z",
      // Paid through live Stripe: the only kind of order whose agreement carries the firm's signature.
      stripe_checkout_session_id: "cs_live_a1B2c3D4e5F6",
    },
  ];
  tables.services = [{ id: SERVICE_ID, name: "NIF only", contract_template: "nif" }];
  tables.users = [{ id: OWNER_ID, email: OWNER.email }];
  tables.user_service_applicants = [{ ...APPLICANT }];
  tables.user_service_contracts = [];
  session.user = OWNER;

  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true, id: "email_1" });
  putObject.mockReset();
  putObject.mockResolvedValue(undefined);
  getObjectBytes.mockReset();
  presignDownload.mockReset();
  presignDownload.mockResolvedValue({ url: PRESIGNED, expiresIn: 120 });
  buildContractValues.mockReset();
  buildContractValues.mockImplementation((input: { signingPlace?: string | null }) =>
    input.signingPlace ? { "[PLACE]": input.signingPlace } : {},
  );
  generateContractPdf.mockReset();
  generateContractPdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));

  logged = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/orders/[id]/contract", () => {
  it("prepares the agreement with no body at all and answers ready", async () => {
    const response = await POST(post(), ctx());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
    expect(tables.user_service_contracts).toHaveLength(1);
    expect(putObject.mock.calls[0][0]).toMatchObject({
      key: expect.stringMatching(new RegExp(`^contracts/${ORDER_ID}/v1-[a-z0-9]{8}\\.pdf$`)),
      contentType: "application/pdf",
    });
    expect(tables.user_service_contracts[0].storage_key).toBe(putObject.mock.calls[0][0].key);
    expect(buildContractValues.mock.calls[0][0].signingPlace).toBeNull();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe(OWNER.email);
    expect(sendEmail.mock.calls[0][0].text).toContain(`${BASE}/en/dashboard/orders/${ORDER_ID}`);
  });

  it("is safe to call again: one agreement, one email", async () => {
    await POST(post("{}"), ctx());
    const again = await POST(post("{}"), ctx());

    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ status: "ready" });
    expect(tables.user_service_contracts).toHaveLength(1);
    expect(generateContractPdf).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("trims the signing place and strips control characters before it is printed", async () => {
    const raw = `  Austin,${String.fromCharCode(10)}Texas${String.fromCharCode(0)}  `;

    const response = await POST(post(JSON.stringify({ signingPlace: raw })), ctx());

    expect(response.status).toBe(200);
    expect(buildContractValues.mock.calls[0][0].signingPlace).toBe("Austin, Texas");
  });

  it("refuses a signing place over 120 characters or one that is not text", async () => {
    const long = await POST(post(JSON.stringify({ signingPlace: "x".repeat(121) })), ctx());
    expect(long.status).toBe(422);
    expect(await errorOf(long)).toBe("Keep the city and country under 120 characters.");

    const notText = await POST(post(JSON.stringify({ signingPlace: 42 })), ctx());
    expect(notText.status).toBe(400);

    expect(tables.user_service_contracts).toHaveLength(0);
  });

  it("refuses a body that is not a JSON object", async () => {
    for (const body of ["{", "[]", '"Austin"', "null"]) {
      const response = await POST(post(body), ctx());
      expect(response.status).toBe(400);
      expect(await errorOf(response)).toBe("Check the details and try again.");
    }
    expect(tables.user_service_contracts).toHaveLength(0);
  });

  it("answers 413 for a body over 4 KB, declared or not", async () => {
    const declared = await POST(post("{}", { "content-length": "4097" }), ctx());
    expect(declared.status).toBe(413);

    const undeclared = await POST(post(JSON.stringify({ signingPlace: "x".repeat(5000) })), ctx());
    expect(undeclared.status).toBe(413);
    expect(await errorOf(undeclared)).toBe("Too much data.");

    expect(tables.user_service_contracts).toHaveLength(0);
  });

  it("answers 409 details_missing, 409 Payment first. and 404 for a service with no contract", async () => {
    tables.user_service_applicants = [];
    const details = await POST(post(), ctx());
    expect(details.status).toBe(409);
    expect(await details.json()).toEqual({ error: "details_missing", applicant: 0 });

    tables.user_services[0].paid_at = null;
    const unpaid = await POST(post(), ctx());
    expect(unpaid.status).toBe(409);
    expect(await errorOf(unpaid)).toBe("Payment first.");

    tables.services[0].contract_template = null;
    const none = await POST(post(), ctx());
    expect(none.status).toBe(404);

    expect(putObject).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("names the person whose details are missing on the Couple package: applicant 0 first, then the partner", async () => {
    tables.services[0] = { id: SERVICE_ID, name: "Couple package", slug: "couple", contract_template: "couple" };

    tables.user_service_applicants = [];
    const nobody = await POST(post(), ctx());
    expect(nobody.status).toBe(409);
    expect(await nobody.json()).toEqual({ error: "details_missing", applicant: 0 });

    tables.user_service_applicants = [{ ...PARTNER }];
    const partnerOnly = await POST(post(), ctx());
    expect(await partnerOnly.json()).toEqual({ error: "details_missing", applicant: 0 });

    tables.user_service_applicants = [{ ...APPLICANT }];
    const firstOnly = await POST(post(), ctx());
    expect(firstOnly.status).toBe(409);
    expect(await firstOnly.json()).toEqual({ error: "details_missing", applicant: 1 });
    expect(putObject).not.toHaveBeenCalled();

    tables.user_service_applicants.push({ ...PARTNER });
    const both = await POST(post(JSON.stringify({ signingPlace: "Lisbon, Portugal" })), ctx());
    expect(both.status).toBe(200);
    expect(await both.json()).toEqual({ status: "ready" });
    expect(generateContractPdf.mock.calls[0][0]).toBe("couple");
    const input = buildContractValues.mock.calls[0][0] as { applicants: { applicant_index: number }[] };
    expect(input.applicants.map((row) => row.applicant_index)).toEqual([0, 1]);
    expect(tables.user_service_contracts).toHaveLength(1);
    expect(tables.user_service_contracts[0].template).toBe("couple");
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("prepares the agreement with the firm's signature when the bucket holds it", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
    getObjectBytes.mockImplementation(async (key: string) => (key === "firm/signature.png" ? png : null));

    const response = await POST(post(), ctx());

    expect(response.status).toBe(200);
    expect(getObjectBytes).toHaveBeenCalledWith("firm/signature.png");
    const options = generateContractPdf.mock.calls[0][2] as { reference: string; signature: Uint8Array | null };
    expect(options.reference).toBe(ORDER_ID);
    expect(Array.from(options.signature ?? [])).toEqual(Array.from(png));
  });

  it("prepares it without the signature, and still answers ready, when the bucket cannot give it", async () => {
    getObjectBytes.mockRejectedValue(new Error("no credentials"));

    const response = await POST(post(), ctx());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
    expect(generateContractPdf.mock.calls[0][2]).toEqual({ reference: ORDER_ID, signature: null });
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it("never puts the firm's signature on an order paid with a test card, as on staging", async () => {
    tables.user_services[0].stripe_checkout_session_id = "cs_test_a1B2c3D4e5F6";
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
    getObjectBytes.mockImplementation(async (key: string) => (key === "firm/signature.png" ? png : null));

    const response = await POST(post(), ctx());

    expect(response.status).toBe(200);
    expect(getObjectBytes).not.toHaveBeenCalledWith("firm/signature.png");
    expect(generateContractPdf.mock.calls[0][2]).toEqual({ reference: ORDER_ID, signature: null, specimen: true });
  });

  it("answers 401 signed out, and 403 the same way for a stranger's order and one that does not exist", async () => {
    session.user = null;
    expect((await POST(post(), ctx())).status).toBe(401);

    session.user = STRANGER;
    const stranger = await POST(post(), ctx());
    const missing = await POST(post(undefined, {}, UNKNOWN_ID), ctx(UNKNOWN_ID));
    const malformed = await POST(post(undefined, {}, "nope"), ctx("nope"));
    for (const response of [stranger, missing, malformed]) {
      expect(response.status).toBe(403);
      expect(await errorOf(response)).toBe("This order is not yours.");
    }
    expect(tables.user_service_contracts).toHaveLength(0);
  });

  it("keeps an admin out: 403 on a client's order, 404 on a missing one", async () => {
    session.user = ADMIN;
    expect((await POST(post(), ctx())).status).toBe(403);
    expect((await POST(post(undefined, {}, UNKNOWN_ID), ctx(UNKNOWN_ID))).status).toBe(404);
    expect(tables.user_service_contracts).toHaveLength(0);
  });

  it("logs a failure and answers a one line 500", async () => {
    putObject.mockRejectedValue(new Error("bucket down"));

    const response = await POST(post(), ctx());

    expect(response.status).toBe(500);
    expect(await errorOf(response)).toBe("Something did not work. Try again.");
    expect(logged).toHaveBeenCalled();
    expect(tables.user_service_contracts).toHaveLength(0);
  });
});

describe("GET /api/orders/[id]/contract", () => {
  /** "%PDF-1.7" and a line break: what the bucket holds under the row's key. */
  const STORED_PDF = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10]);

  beforeEach(() => {
    tables.user_service_contracts = [{ ...CONTRACT }];
    getObjectBytes.mockResolvedValue(STORED_PDF);
  });

  it("streams the stored PDF to the owner: inline, named, never cached, never sniffed", async () => {
    const response = await GET(get(), ctx());

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-length")).toBe(String(STORED_PDF.byteLength));
    expect(response.headers.get("content-disposition")).toBe(
      "inline; filename=\"service-agreement-nif-jane-alice-doe.pdf\"; filename*=UTF-8''service-agreement-nif-jane-alice-doe.pdf",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(STORED_PDF);

    expect(getObjectBytes).toHaveBeenCalledTimes(1);
    expect(getObjectBytes).toHaveBeenCalledWith(`contracts/${ORDER_ID}/v3.pdf`);
    // No presigned URL is handed out any more: the tab never leaves this site.
    expect(presignDownload).not.toHaveBeenCalled();
  });

  it("answers an attachment with ?download=1 and nothing else", async () => {
    const saved = await GET(get("?download=1"), ctx());
    expect(saved.status).toBe(200);
    expect(saved.headers.get("content-disposition")).toMatch(/^attachment; filename="service-agreement-nif-jane-alice-doe\.pdf";/);

    const shown = await GET(get("?download=0"), ctx());
    expect(shown.headers.get("content-disposition")).toMatch(/^inline; /);
  });

  it("keeps a file name that was typed with quotes or line breaks inside its header", async () => {
    tables.user_service_contracts[0].file_name = 'agree"ment\r\nX-Evil: 1 Ł.pdf';

    const response = await GET(get(), ctx());

    expect(response.status).toBe(200);
    const disposition = response.headers.get("content-disposition") ?? "";
    expect(disposition.startsWith('inline; filename="agreementX-Evil: 1 .pdf"; filename*=UTF-8\'\'')).toBe(true);
    expect(disposition).not.toMatch(/[\r\n]/);
    expect(response.headers.get("x-evil")).toBeNull();
  });

  it("generates and sends nothing", async () => {
    await GET(get(), ctx());
    expect(generateContractPdf).not.toHaveBeenCalled();
    expect(putObject).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends a visitor without a session to login, and from there to the order", async () => {
    session.user = null;

    const response = await GET(get(), ctx());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${BASE}/en/login?next=/en/dashboard/orders/${ORDER_ID}`);
    expect(getObjectBytes).not.toHaveBeenCalled();
  });

  it("echoes nothing but a UUID into the login redirect", async () => {
    session.user = null;

    for (const id of ["nope", "../admin", `${ORDER_ID}?x=1`, "%0d%0aSet-Cookie:x"]) {
      const response = await GET(get("", encodeURIComponent(id)), ctx(id));
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(`${BASE}/en/login?next=/en/dashboard`);
    }
  });

  it("lets an admin download and tells them when the order is missing", async () => {
    session.user = ADMIN;
    expect((await GET(get(), ctx())).status).toBe(200);
    expect((await GET(get("", UNKNOWN_ID), ctx(UNKNOWN_ID))).status).toBe(404);
  });

  it("answers 403 the same way for a stranger's order and one that does not exist", async () => {
    session.user = STRANGER;
    for (const response of [await GET(get(), ctx()), await GET(get("", UNKNOWN_ID), ctx(UNKNOWN_ID))]) {
      expect(response.status).toBe(403);
      expect(await errorOf(response)).toBe("This order is not yours.");
    }
    expect(getObjectBytes).not.toHaveBeenCalled();
  });

  it("answers 404 No agreement yet. when none was prepared", async () => {
    tables.user_service_contracts = [];

    const response = await GET(get(), ctx());

    expect(response.status).toBe(404);
    expect(await errorOf(response)).toBe("No agreement yet.");
  });

  it("logs a failure and answers a one line 500, for a bucket that is down and for a file that is gone", async () => {
    getObjectBytes.mockRejectedValueOnce(new Error("no credentials"));
    const down = await GET(get(), ctx());
    expect(down.status).toBe(500);
    expect(await errorOf(down)).toBe("Something did not work. Try again.");

    getObjectBytes.mockResolvedValueOnce(null);
    const gone = await GET(get(), ctx());
    expect(gone.status).toBe(500);
    expect(await errorOf(gone)).toBe("Something did not work. Try again.");

    expect(logged).toHaveBeenCalledTimes(2);
  });
});
