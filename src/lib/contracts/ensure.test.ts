import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/lib/db/queries";
import type { UserServiceApplicantRow, UserServiceContractRow } from "@/lib/db/types";

/**
 * ensureContract and regenerateContract against a fake database, a fake
 * bucket, a spied email sender and stand ins for the two modules another
 * part of the round writes (the contract's values and its PDF), so nothing
 * here depends on the models, on pdf-lib or on the network.
 *
 * The fake database answers reads from `tables`, applies inserts and updates
 * to them in place, refuses a second contract row for the same order with
 * Postgres' unique_violation (23505), and fails on demand through `failures`.
 */

type Row = Record<string, unknown>;
type Write = { table: string; op: "insert" | "update"; payload: Row };
type Failure = { table: string; op: "select" | "insert" | "update"; message: string };

const {
  tables,
  writes,
  failures,
  sendEmail,
  putObject,
  getObjectBytes,
  buildContractValues,
  contractFileName,
  generateContractPdf,
} = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  writes: [] as { table: string; op: "insert" | "update"; payload: Record<string, unknown> }[],
  failures: [] as { table: string; op: "select" | "insert" | "update"; message: string }[],
  sendEmail: vi.fn(),
  putObject: vi.fn(),
  getObjectBytes: vi.fn(),
  buildContractValues: vi.fn(),
  contractFileName: vi.fn(),
  generateContractPdf: vi.fn(),
}));

vi.mock("@/lib/email/send", () => ({ sendEmail }));
vi.mock("@/lib/r2/client", () => ({ putObject, getObjectBytes }));
vi.mock("@/content/contracts/variables", () => ({ buildContractValues, contractFileName }));
vi.mock("@/lib/contracts/generate", () => ({ generateContractPdf }));

import { MANUAL_PAYMENT_LIVE_NOTE, MANUAL_PAYMENT_TEST_NOTE } from "@/lib/orders/manual-payment";

import {
  ContractError,
  FIRM_SIGNATURE_KEY,
  MAX_SIGNING_PLACE_LENGTH,
  contractState,
  contractStatus,
  contractStorageKey,
  ensureContract,
  parseSigningPlace,
  regenerateContract,
} from "./ensure";

function fakeDb(): Db {
  return {
    from(table: string) {
      const filters: [string, unknown][] = [];
      let op: "select" | "insert" | "update" = "select";
      let payload: Row = {};
      const rows = () => (tables[table] ??= []);
      const matching = () => rows().filter((row) => filters.every(([c, v]) => row[c] === v));
      const run = (): { data: Row[] | null; error: { message: string; code?: string } | null } => {
        const planned = failures.findIndex((f: Failure) => f.table === table && f.op === op);
        if (planned >= 0) {
          const [failure] = failures.splice(planned, 1);
          return { data: null, error: { message: failure.message } };
        }
        if (op === "insert") {
          if (table === "user_service_contracts" && rows().some((r) => r.user_service_id === payload.user_service_id)) {
            return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
          }
          const now = new Date().toISOString();
          const row: Row = { id: crypto.randomUUID(), emailed_at: null, created_at: now, updated_at: now, ...payload };
          rows().push(row);
          writes.push({ table, op, payload } satisfies Write);
          return { data: [{ ...row }], error: null };
        }
        if (op === "update") {
          const hit = matching();
          for (const row of hit) Object.assign(row, payload);
          writes.push({ table, op, payload } satisfies Write);
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
          const r = run();
          return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error });
        },
        single() {
          const r = run();
          if (r.error) return Promise.resolve({ data: null, error: r.error });
          return Promise.resolve(
            r.data?.[0] ? { data: r.data[0], error: null } : { data: null, error: { message: "no rows" } },
          );
        },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return query;
    },
  } as unknown as Db;
}

const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const LATIN_LETTERS = "Use Latin letters, as in the machine readable line of your passport.";
const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const SERVICE_ID = "44444444-4444-4444-8444-444444444444";
const ORIGIN = "http://localhost:3000";
const PAID_AT = "2026-09-21T10:15:00.000Z";
/** The seeded order was paid through live Stripe, so its agreement may carry the firm's signature. */
const LIVE_SESSION = "cs_live_a1B2c3D4e5F6";
const TEST_SESSION = "cs_test_a1B2c3D4e5F6";
const PDF_BYTES = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
const STORED_BYTES = new Uint8Array([37, 80, 68, 70, 45, 115, 116, 111, 114, 101, 100]);
/** The eight bytes every PNG starts with, and a little more: what the firm's signature file looks like to ensure.ts. */
const SIGNATURE_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
const COUPLE_SERVICE_ID = "66666666-6666-4666-8666-666666666666";

function applicant(overrides: Partial<UserServiceApplicantRow> = {}): UserServiceApplicantRow {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    user_service_id: ORDER_ID,
    applicant_index: 0,
    full_name: "Jane Alice Doe",
    gender: "f",
    birth_place: "Austin, Texas, United States of America",
    birth_date: "1984-07-04",
    passport_number: "X1234567",
    passport_issuer: "United States Department of State",
    passport_issued_on: "2021-03-12",
    passport_expires_on: "2031-03-11",
    tax_address: "1200 West 6th Street, Austin, TX 78703, USA",
    created_at: "2026-09-21T10:20:00.000Z",
    updated_at: "2026-09-21T10:20:00.000Z",
    ...overrides,
  };
}

function contractRow(overrides: Partial<UserServiceContractRow> = {}): UserServiceContractRow {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    user_service_id: ORDER_ID,
    template: "nif",
    version: 1,
    storage_key: `contracts/${ORDER_ID}/v1.pdf`,
    file_name: "service-agreement-nif-jane-alice-doe.pdf",
    size_bytes: STORED_BYTES.byteLength,
    variables: { "[FULL NAME]": "Jane Alice Doe", "[PLACE]": "Austin, USA" },
    generated_at: "2026-09-21T10:21:00.000Z",
    emailed_at: "2026-09-21T10:21:02.000Z",
    created_at: "2026-09-21T10:21:00.000Z",
    updated_at: "2026-09-21T10:21:02.000Z",
    ...overrides,
  };
}

function seed() {
  tables.user_services = [
    {
      id: ORDER_ID,
      user_id: OWNER_ID,
      service_id: SERVICE_ID,
      total_cents: 14900,
      paid_at: PAID_AT,
      stripe_checkout_session_id: LIVE_SESSION,
    },
  ];
  tables.services = [{ id: SERVICE_ID, slug: "nif-only", name: "NIF only", contract_template: "nif" }];
  tables.users = [{ id: OWNER_ID, email: "client@example.com" }];
  tables.user_service_applicants = [applicant()];
  tables.user_service_contracts = [];
}

/** The order becomes a Couple package order: the service names the model for two, and the partner's details are there. */
function seedCouple() {
  tables.services = [{ id: COUPLE_SERVICE_ID, slug: "couple", name: "Couple package", contract_template: "couple" }];
  tables.user_services[0].service_id = COUPLE_SERVICE_ID;
  tables.user_services[0].total_cents = 59700;
  tables.user_services[0].applicants = 2;
  tables.user_service_applicants = [partnerRow(), applicant()];
}

function partnerRow(overrides: Partial<UserServiceApplicantRow> = {}): UserServiceApplicantRow {
  return applicant({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    applicant_index: 1,
    full_name: "John Robert Doe",
    gender: "m",
    passport_number: "Y7654321",
    ...overrides,
  });
}

function stored(): UserServiceContractRow | undefined {
  return tables.user_service_contracts[0] as unknown as UserServiceContractRow | undefined;
}

/** A key this module writes for `version`: the version, then the random suffix of one attempt. */
function versionKey(version: number) {
  return expect.stringMatching(new RegExp(`^contracts/${ORDER_ID}/v${version}-[a-z0-9]{8}\\.pdf$`));
}

/** The keys getObjectBytes was asked for, in order. */
function bytesAskedFor(): string[] {
  return getObjectBytes.mock.calls.map(([key]) => key as string);
}

/** The bucket as it starts: the stored agreements are there, the firm's signature is not. */
function bucket(signature: Uint8Array | null = null) {
  getObjectBytes.mockImplementation(async (key: string) => (key === FIRM_SIGNATURE_KEY ? signature : STORED_BYTES));
}

/** A character by code point, so the control characters under test are visible in the source. */
function ch(code: number): string {
  return String.fromCharCode(code);
}

const db = fakeDb();

/** Failures are logged, never thrown: the spy keeps the run quiet and lets a test check the line was written. */
let logged: ReturnType<typeof vi.spyOn>;

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
  writes.length = 0;
  failures.length = 0;
  for (const key of Object.keys(tables)) delete tables[key];
  seed();

  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true, id: "email_1" });
  putObject.mockReset();
  putObject.mockResolvedValue(undefined);
  getObjectBytes.mockReset();
  bucket();
  buildContractValues.mockReset();
  // Like the real one: a token with no value is left out of the record.
  buildContractValues.mockImplementation(
    (input: { applicants: UserServiceApplicantRow[]; email: string; signingPlace?: string | null }) => {
      const values: Record<string, string> = {};
      if (input.applicants[0]) values["[FULL NAME]"] = input.applicants[0].full_name;
      if (input.applicants[1]) values["[FULL NAME 2]"] = input.applicants[1].full_name;
      if (input.email) values["[EMAIL]"] = input.email;
      if (input.signingPlace) values["[PLACE]"] = input.signingPlace;
      return values;
    },
  );
  contractFileName.mockReset();
  contractFileName.mockImplementation((template: string) => `service-agreement-${template}-jane-alice-doe.pdf`);
  generateContractPdf.mockReset();
  generateContractPdf.mockResolvedValue(PDF_BYTES);
});

describe("contractState", () => {
  const paid = { paid_at: PAID_AT };
  const unpaid = { paid_at: null };
  const withContract = { contract_template: "nif" as const };

  it("is ready as soon as a contract row exists, whatever else changed since", () => {
    expect(contractState(paid, withContract, [applicant()], contractRow())).toBe("ready");
    expect(contractState(paid, { contract_template: null }, [], contractRow())).toBe("ready");
    expect(contractState(paid, null, [], contractRow())).toBe("ready");
  });

  it("is off for a service with no contract and for an unpaid order", () => {
    expect(contractState(paid, { contract_template: null }, [applicant()], null)).toBe("off");
    expect(contractState(paid, null, [applicant()], null)).toBe("off");
    expect(contractState(unpaid, withContract, [applicant()], null)).toBe("off");
  });

  it("waits for the client's confirmation on a paid order with a contract, details typed or not", () => {
    expect(contractState(paid, withContract, [], null)).toBe("needs_details");
    expect(contractState(paid, withContract, [applicant()], null)).toBe("needs_details");
  });

  it("is offered from here with the person whose details are missing, the partner's on the Couple package", () => {
    const couple = { contract_template: "couple" as const };
    expect(contractStatus(paid, couple, [], null)).toEqual({ state: "needs_details", missing: 0, persons: 2 });
    expect(contractStatus(paid, couple, [applicant()], null)).toEqual({ state: "needs_details", missing: 1, persons: 2 });
    expect(contractStatus(paid, couple, [applicant(), partnerRow()], null)).toEqual({
      state: "needs_details",
      missing: null,
      persons: 2,
    });
  });
});

describe("parseSigningPlace", () => {
  it("reads missing, null and blank as no place", () => {
    expect(parseSigningPlace(undefined)).toEqual({ ok: true, value: null });
    expect(parseSigningPlace(null)).toEqual({ ok: true, value: null });
    expect(parseSigningPlace("   ")).toEqual({ ok: true, value: null });
    expect(parseSigningPlace(`${ch(0)}${ch(0x200b)}`)).toEqual({ ok: true, value: null });
  });

  it("trims, turns line breaks into a space and drops control characters", () => {
    const raw = `  Austin,${ch(10)}Texas${ch(0)},${ch(9)} United${ch(0x200b)} States${ch(0x7f)}${ch(0x85)}  `;
    expect(parseSigningPlace(raw)).toEqual({ ok: true, value: "Austin, Texas, United States" });
  });

  it("allows 120 characters, counted as characters, and refuses more with a line for the form", () => {
    expect(parseSigningPlace("x".repeat(MAX_SIGNING_PLACE_LENGTH))).toMatchObject({ ok: true });
    // 120 astral characters are 240 UTF-16 units and still within the limit: it is their letters, not their
    // length, that the agreement cannot take. One more and the length is what is wrong.
    expect(parseSigningPlace("𝔘".repeat(MAX_SIGNING_PLACE_LENGTH))).toMatchObject({ ok: false, message: LATIN_LETTERS });
    expect(parseSigningPlace("𝔘".repeat(MAX_SIGNING_PLACE_LENGTH + 1))).toMatchObject({
      ok: false,
      message: "Keep the city and country under 120 characters.",
    });
    expect(parseSigningPlace("x".repeat(MAX_SIGNING_PLACE_LENGTH + 1))).toEqual({
      ok: false,
      status: 422,
      message: "Keep the city and country under 120 characters.",
    });
  });

  it("refuses a place the agreement would print as question marks, and takes accents", () => {
    for (const raw of ["Москва, Россия", "北京, 中国", "دبي", "Austin 🙂"]) {
      expect(parseSigningPlace(raw), raw).toEqual({ ok: false, status: 422, message: LATIN_LETTERS });
    }
    expect(parseSigningPlace("São Paulo, Brasil")).toEqual({ ok: true, value: "São Paulo, Brasil" });
    // Kept as typed: the spelling without accents is decided where the value is printed.
    expect(parseSigningPlace("Łódź, Polska")).toEqual({ ok: true, value: "Łódź, Polska" });
    expect(parseSigningPlace("São Paulo".normalize("NFD"))).toEqual({ ok: true, value: "São Paulo".normalize("NFC") });
  });

  it("refuses anything that is not text", () => {
    for (const raw of [42, true, ["Austin"], { city: "Austin" }]) {
      expect(parseSigningPlace(raw)).toEqual({ ok: false, status: 400, message: "Check the details and try again." });
    }
  });
});

describe("contractStorageKey", () => {
  it("follows contracts/{order}/v{version}-{nonce}.pdf", () => {
    expect(contractStorageKey(ORDER_ID, 1, "ab12cd34")).toBe(`contracts/${ORDER_ID}/v1-ab12cd34.pdf`);
    expect(contractStorageKey(ORDER_ID, 12, "ab12cd34")).toBe(`contracts/${ORDER_ID}/v12-ab12cd34.pdf`);
  });

  it("gives every attempt at a version a key of its own", () => {
    const keys = new Set(Array.from({ length: 50 }, () => contractStorageKey(ORDER_ID, 1)));
    expect(keys.size).toBe(50);
    for (const key of keys) expect(key).toEqual(versionKey(1));
  });

  it("refuses an id that could leave the folder, a version that is not a positive whole number and an odd suffix", () => {
    expect(() => contractStorageKey("../x", 1)).toThrow();
    expect(() => contractStorageKey(`${ORDER_ID}/x`, 1)).toThrow();
    expect(() => contractStorageKey(ORDER_ID, 0)).toThrow();
    expect(() => contractStorageKey(ORDER_ID, 1.5)).toThrow();
    expect(() => contractStorageKey(ORDER_ID, 1, "../x")).toThrow();
    expect(() => contractStorageKey(ORDER_ID, 1, "")).toThrow();
  });
});

describe("ensureContract", () => {
  function expectNoSideEffects() {
    expect(writes).toHaveLength(0);
    expect(generateContractPdf).not.toHaveBeenCalled();
    expect(putObject).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  }

  it("is off for an unknown order, without side effects", async () => {
    const result = await ensureContract(db, "00000000-0000-4000-8000-000000000000");
    expect(result).toEqual({ status: "off", reason: "order_not_found" });
    expectNoSideEffects();
  });

  it("is off when the service names no contract, as the Couple package does", async () => {
    tables.services[0].contract_template = null;
    expect(await ensureContract(db, ORDER_ID)).toEqual({ status: "off", reason: "no_template" });
    expectNoSideEffects();
  });

  it("is off for an unpaid order", async () => {
    tables.user_services[0].paid_at = null;
    expect(await ensureContract(db, ORDER_ID)).toEqual({ status: "off", reason: "unpaid" });
    expectNoSideEffects();
  });

  it("needs details while applicant 0 has none, even when applicant 1 has, and names applicant 0", async () => {
    tables.user_service_applicants = [applicant({ applicant_index: 1 })];
    expect(await ensureContract(db, ORDER_ID)).toEqual({ status: "needs_details", applicant: 0 });
    expectNoSideEffects();
  });

  it("generates, stores, records and emails the agreement", async () => {
    const result = await ensureContract(db, ORDER_ID, { signingPlace: "Austin, USA", origin: ORIGIN });

    expect(buildContractValues).toHaveBeenCalledTimes(1);
    expect(buildContractValues).toHaveBeenCalledWith({
      order: expect.objectContaining({ id: ORDER_ID, total_cents: 14900, paid_at: PAID_AT }),
      service: { slug: "nif-only", name: "NIF only", contract_template: "nif" },
      applicants: [applicant()],
      email: "client@example.com",
      signingPlace: "Austin, USA",
    });
    const values = buildContractValues.mock.results[0].value;
    // No signature in the bucket yet: the generator is told so and leaves the line blank.
    expect(generateContractPdf).toHaveBeenCalledTimes(1);
    expect(generateContractPdf).toHaveBeenCalledWith("nif", values, { reference: ORDER_ID, signature: null });
    expect(bytesAskedFor()).toEqual([FIRM_SIGNATURE_KEY]);
    expect(contractFileName).toHaveBeenCalledWith("nif", "Jane Alice Doe");

    expect(putObject).toHaveBeenCalledTimes(1);
    const put = putObject.mock.calls[0][0];
    expect(put.key).toEqual(versionKey(1));
    expect(put.contentType).toBe("application/pdf");
    expect(Array.from(put.body as Uint8Array)).toEqual(Array.from(PDF_BYTES));

    expect(writes[0]).toMatchObject({ table: "user_service_contracts", op: "insert" });
    expect(writes[0].payload).toMatchObject({
      user_service_id: ORDER_ID,
      template: "nif",
      version: 1,
      storage_key: put.key,
      file_name: "service-agreement-nif-jane-alice-doe.pdf",
      size_bytes: PDF_BYTES.byteLength,
      variables: values,
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const email = sendEmail.mock.calls[0][0];
    expect(email.to).toBe("client@example.com");
    expect(email.subject).toBe("Your service agreement");
    expect(email.text).toContain("NIF only");
    expect(email.text).toContain(`${ORIGIN}/en/dashboard/orders/${ORDER_ID}`);
    expect(email.html).toContain(`${ORIGIN}/en/dashboard/orders/${ORDER_ID}`);
    // House rules for anything a client reads: no dash as punctuation, none of the words the firm avoids.
    const dashes = new RegExp(`[${ch(0x2013)}${ch(0x2014)}]| - `);
    expect(email.text).not.toMatch(dashes);
    expect(email.text).not.toMatch(/\bproblem\b|\btrap\b|\bfree\b|refund|money back|video call|run by lawyers/i);
    expect(email.attachments).toHaveLength(1);
    expect(email.attachments[0].filename).toBe("service-agreement-nif-jane-alice-doe.pdf");
    expect(Array.from(email.attachments[0].content as Uint8Array)).toEqual(Array.from(PDF_BYTES));

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.created).toBe(true);
    expect(result.emailed).toBe(true);
    expect(typeof result.contract.emailed_at).toBe("string");
    expect(typeof stored()?.emailed_at).toBe("string");
    expect(tables.user_service_contracts).toHaveLength(1);
  });

  it("uploads before it records, so a row never points at a file that is not there", async () => {
    putObject.mockRejectedValue(new Error("bucket down"));

    await expect(ensureContract(db, ORDER_ID)).rejects.toThrow("bucket down");
    expect(tables.user_service_contracts).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("cleans the place it is handed and prints nothing for a blank one", async () => {
    await ensureContract(db, ORDER_ID, { signingPlace: `  Lisbon,${ch(10)}Portugal ` });
    expect(buildContractValues.mock.calls[0][0].signingPlace).toBe("Lisbon, Portugal");

    tables.user_service_contracts = [];
    await ensureContract(db, ORDER_ID, { signingPlace: "  " });
    expect(buildContractValues.mock.calls[1][0].signingPlace).toBeNull();
  });

  it("is idempotent: a second call generates nothing and sends nothing", async () => {
    const first = await ensureContract(db, ORDER_ID, { origin: ORIGIN });
    const second = await ensureContract(db, ORDER_ID, { origin: ORIGIN });

    expect(second).toMatchObject({ status: "ready", created: false, emailed: false });
    if (first.status !== "ready" || second.status !== "ready") throw new Error("expected ready twice");
    expect(second.contract.id).toBe(first.contract.id);
    expect(generateContractPdf).toHaveBeenCalledTimes(1);
    expect(putObject).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    // The first call read the signature to generate; the second read nothing, not even the stored file.
    expect(bytesAskedFor()).toEqual([FIRM_SIGNATURE_KEY]);
    expect(tables.user_service_contracts).toHaveLength(1);
  });

  it("stays ready for an agreement made before the service lost its contract or the payment was reverted", async () => {
    tables.user_service_contracts = [contractRow()];
    tables.services[0].contract_template = null;
    tables.user_services[0].paid_at = null;

    expect(await ensureContract(db, ORDER_ID)).toMatchObject({ status: "ready", created: false });
    expect(generateContractPdf).not.toHaveBeenCalled();
  });

  it("never fails on a failed email, and the next call retries the email only", async () => {
    sendEmail.mockResolvedValueOnce({ ok: false });

    const first = await ensureContract(db, ORDER_ID, { origin: ORIGIN });

    expect(first).toMatchObject({ status: "ready", created: true, emailed: false });
    expect(stored()?.emailed_at).toBeNull();

    const second = await ensureContract(db, ORDER_ID, { origin: ORIGIN });

    expect(second).toMatchObject({ status: "ready", created: false, emailed: true });
    expect(generateContractPdf).toHaveBeenCalledTimes(1);
    expect(putObject).toHaveBeenCalledTimes(1);
    expect(getObjectBytes).toHaveBeenCalledWith(putObject.mock.calls[0][0].key);
    expect(stored()?.storage_key).toBe(putObject.mock.calls[0][0].key);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    const retry = sendEmail.mock.calls[1][0];
    expect(retry.to).toBe("client@example.com");
    expect(Array.from(retry.attachments[0].content as Uint8Array)).toEqual(Array.from(STORED_BYTES));
    expect(typeof stored()?.emailed_at).toBe("string");

    // Stamped now: a third call sends nothing more.
    await ensureContract(db, ORDER_ID, { origin: ORIGIN });
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("stays ready when the sender throws or the stamp cannot be written", async () => {
    sendEmail.mockRejectedValueOnce(new Error("socket hang up"));
    expect(await ensureContract(db, ORDER_ID)).toMatchObject({ status: "ready", created: true, emailed: false });
    expect(logged).toHaveBeenCalledTimes(1);

    tables.user_service_contracts = [];
    failures.push({ table: "user_service_contracts", op: "update", message: "connection reset" });
    expect(await ensureContract(db, ORDER_ID)).toMatchObject({ status: "ready", created: true, emailed: true });
    expect(stored()?.emailed_at).toBeNull();
    expect(logged).toHaveBeenCalledTimes(2);
  });

  it("stays ready when the retry cannot find the stored file or cannot reach the bucket", async () => {
    tables.user_service_contracts = [contractRow({ emailed_at: null })];

    getObjectBytes.mockResolvedValueOnce(null);
    expect(await ensureContract(db, ORDER_ID)).toMatchObject({ status: "ready", created: false, emailed: false });

    getObjectBytes.mockRejectedValueOnce(new Error("bucket down"));
    expect(await ensureContract(db, ORDER_ID)).toMatchObject({ status: "ready", created: false, emailed: false });

    expect(sendEmail).not.toHaveBeenCalled();
    expect(stored()?.emailed_at).toBeNull();
    expect(logged).toHaveBeenCalledTimes(2);
  });

  it("generates without an email when the account has no address on record", async () => {
    tables.users = [];

    const result = await ensureContract(db, ORDER_ID);

    expect(result).toMatchObject({ status: "ready", created: true, emailed: false });
    // The values take a string: an empty one, which prints the model's own bracket.
    expect(buildContractValues.mock.calls[0][0].email).toBe("");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("loses a race gracefully: on a duplicate key it reads the winner's row and sends nothing", async () => {
    const winner = contractRow({ emailed_at: null });
    // The other call records its row while this one is still uploading.
    putObject.mockImplementationOnce(async () => {
      tables.user_service_contracts.push({ ...winner });
    });

    const result = await ensureContract(db, ORDER_ID, { origin: ORIGIN });

    expect(result).toMatchObject({ status: "ready", created: false, emailed: false });
    if (result.status !== "ready") return;
    expect(result.contract.id).toBe(winner.id);
    expect(tables.user_service_contracts).toHaveLength(1);
    expect(writes).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
    // It read the signature to generate its own copy, and never the winner's file to email it.
    expect(bytesAskedFor()).toEqual([FIRM_SIGNATURE_KEY]);
    // Its own upload went to a key of its own, so the file the winner's row describes is untouched.
    expect(putObject.mock.calls[0][0].key).toEqual(versionKey(1));
    expect(putObject.mock.calls[0][0].key).not.toBe(winner.storage_key);
    expect(tables.user_service_contracts[0].storage_key).toBe(winner.storage_key);
  });

  it("throws on an insert error that is not a duplicate", async () => {
    failures.push({ table: "user_service_contracts", op: "insert", message: "disk full" });

    await expect(ensureContract(db, ORDER_ID)).rejects.toThrow("contracts insert: disk full");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("prints applicant 0 alone on a one person model, even with a partner row on the order", async () => {
    tables.user_service_applicants = [partnerRow(), applicant()];

    await ensureContract(db, ORDER_ID);

    expect(buildContractValues.mock.calls[0][0].applicants).toEqual([applicant()]);
  });
});

describe("ensureContract for the Couple package", () => {
  function expectNothingPrepared() {
    expect(writes).toHaveLength(0);
    expect(generateContractPdf).not.toHaveBeenCalled();
    expect(putObject).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  }

  it("needs applicant 0 first, with or without the partner's details", async () => {
    seedCouple();
    tables.user_service_applicants = [];
    expect(await ensureContract(db, ORDER_ID)).toEqual({ status: "needs_details", applicant: 0 });

    tables.user_service_applicants = [partnerRow()];
    expect(await ensureContract(db, ORDER_ID)).toEqual({ status: "needs_details", applicant: 0 });
    expectNothingPrepared();
  });

  it("needs the partner once applicant 0 is in", async () => {
    seedCouple();
    tables.user_service_applicants = [applicant()];

    expect(await ensureContract(db, ORDER_ID)).toEqual({ status: "needs_details", applicant: 1 });
    expectNothingPrepared();
  });

  it("prepares one agreement naming both, applicant 0 first, recorded under the couple model", async () => {
    seedCouple();

    const result = await ensureContract(db, ORDER_ID, { signingPlace: "Lisbon, Portugal", origin: ORIGIN });

    expect(result).toMatchObject({ status: "ready", created: true, emailed: true });
    expect(buildContractValues).toHaveBeenCalledWith({
      order: expect.objectContaining({ id: ORDER_ID, total_cents: 59700 }),
      service: { slug: "couple", name: "Couple package", contract_template: "couple" },
      applicants: [applicant(), partnerRow()],
      email: "client@example.com",
      signingPlace: "Lisbon, Portugal",
    });
    expect(generateContractPdf.mock.calls[0][0]).toBe("couple");
    expect(contractFileName).toHaveBeenCalledWith("couple", "Jane Alice Doe");
    expect(tables.user_service_contracts).toHaveLength(1);
    expect(stored()).toMatchObject({ template: "couple", version: 1 });
    expect(stored()?.variables).toMatchObject({ "[FULL NAME]": "Jane Alice Doe", "[FULL NAME 2]": "John Robert Doe" });
    // One agreement, one email, to the account.
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe("client@example.com");
    expect(sendEmail.mock.calls[0][0].text).toContain("Couple package");
  });

  it("stays idempotent for two people: the second call prepares nothing", async () => {
    seedCouple();
    await ensureContract(db, ORDER_ID);
    const again = await ensureContract(db, ORDER_ID);

    expect(again).toMatchObject({ status: "ready", created: false, emailed: false });
    expect(generateContractPdf).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("the firm's signature", () => {
  it("is read from firm/signature.png and handed to the generator when it is there", async () => {
    bucket(SIGNATURE_PNG);

    const result = await ensureContract(db, ORDER_ID);

    expect(result).toMatchObject({ status: "ready", created: true });
    expect(getObjectBytes).toHaveBeenCalledWith("firm/signature.png");
    expect(generateContractPdf).toHaveBeenCalledTimes(1);
    const options = generateContractPdf.mock.calls[0][2];
    expect(options.reference).toBe(ORDER_ID);
    expect(Array.from(options.signature as Uint8Array)).toEqual(Array.from(SIGNATURE_PNG));
    expect(logged).not.toHaveBeenCalled();
  });

  it("is left out, quietly, while the file is not in the bucket", async () => {
    bucket(null);

    expect(await ensureContract(db, ORDER_ID)).toMatchObject({ status: "ready", created: true });
    expect(generateContractPdf.mock.calls[0][2]).toEqual({ reference: ORDER_ID, signature: null });
    expect(logged).not.toHaveBeenCalled();
  });

  it("is left out, with a log line, when the bucket fails or the file is not a PNG, and the agreement still goes out", async () => {
    getObjectBytes.mockRejectedValueOnce(new Error("bucket down"));
    expect(await ensureContract(db, ORDER_ID)).toMatchObject({ status: "ready", created: true, emailed: true });
    expect(generateContractPdf.mock.calls[0][2]).toEqual({ reference: ORDER_ID, signature: null });
    expect(logged).toHaveBeenCalledTimes(1);

    tables.user_service_contracts = [];
    bucket(STORED_BYTES);
    expect(await ensureContract(db, ORDER_ID)).toMatchObject({ status: "ready", created: true });
    expect(generateContractPdf.mock.calls[1][2]).toEqual({ reference: ORDER_ID, signature: null });
    expect(logged).toHaveBeenCalledTimes(2);
  });

  it("is dropped when the generator cannot draw it: the agreement is generated again without it", async () => {
    bucket(SIGNATURE_PNG);
    generateContractPdf.mockRejectedValueOnce(new Error("Unknown PNG chunk"));

    const result = await ensureContract(db, ORDER_ID);

    expect(result).toMatchObject({ status: "ready", created: true, emailed: true });
    expect(generateContractPdf).toHaveBeenCalledTimes(2);
    expect(generateContractPdf.mock.calls[0][2].signature).toBeInstanceOf(Uint8Array);
    expect(generateContractPdf.mock.calls[1][2]).toEqual({ reference: ORDER_ID, signature: null });
    expect(logged).toHaveBeenCalledTimes(1);
    expect(tables.user_service_contracts).toHaveLength(1);
  });

  it("does not hide a failure of the generator itself", async () => {
    generateContractPdf.mockRejectedValue(new Error("font missing"));

    await expect(ensureContract(db, ORDER_ID)).rejects.toThrow("font missing");
    expect(tables.user_service_contracts).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("is not read when an agreement is only emailed again", async () => {
    bucket(SIGNATURE_PNG);
    tables.user_service_contracts = [contractRow({ emailed_at: null })];

    await ensureContract(db, ORDER_ID);

    expect(bytesAskedFor()).toEqual([`contracts/${ORDER_ID}/v1.pdf`]);
    expect(generateContractPdf).not.toHaveBeenCalled();
  });
});

/**
 * Staging, local development and every Stripe test payment share the bucket
 * that holds the firm's signature, and the database. Only an order paid with
 * real money may carry it; every other agreement is a specimen. A payment
 * recorded outside the platform counts as real only when the order's own
 * events say it was recorded on production (src/lib/orders/live-payment.ts),
 * never because of the host preparing the agreement.
 */
describe("the firm's signature on an order not paid with real money", () => {
  beforeEach(() => {
    bucket(SIGNATURE_PNG);
  });

  /** A payment the admin recorded outside the platform, with the note the deploy wrote. */
  function paidOutside(note: string) {
    tables.user_services[0].stripe_checkout_session_id = null;
    tables.user_service_events = [
      { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", user_service_id: ORDER_ID, to_stage: "documents", note },
    ];
  }

  it("is never read for a test card's order, and the agreement is a specimen", async () => {
    tables.user_services[0].stripe_checkout_session_id = TEST_SESSION;
    // Whatever the events say: the session says how the order was paid.
    tables.user_service_events = [{ id: "e1", user_service_id: ORDER_ID, to_stage: "documents", note: MANUAL_PAYMENT_LIVE_NOTE }];

    expect(await ensureContract(db, ORDER_ID)).toMatchObject({ status: "ready", created: true, emailed: true });

    expect(bytesAskedFor()).not.toContain(FIRM_SIGNATURE_KEY);
    expect(generateContractPdf.mock.calls[0][2]).toEqual({ reference: ORDER_ID, signature: null, specimen: true });
  });

  it("is never read for a payment recorded outside the platform on staging or in development", async () => {
    paidOutside(MANUAL_PAYMENT_TEST_NOTE);

    await ensureContract(db, ORDER_ID);

    expect(bytesAskedFor()).not.toContain(FIRM_SIGNATURE_KEY);
    expect(generateContractPdf.mock.calls[0][2]).toEqual({ reference: ORDER_ID, signature: null, specimen: true });
  });

  it("is never read for a payment recorded before the note said where", async () => {
    paidOutside("Paid outside the platform, recorded by the admin");

    await ensureContract(db, ORDER_ID);

    expect(bytesAskedFor()).not.toContain(FIRM_SIGNATURE_KEY);
    expect(generateContractPdf.mock.calls[0][2]).toEqual({ reference: ORDER_ID, signature: null, specimen: true });
  });

  it("is read for a payment recorded outside the platform on production", async () => {
    paidOutside(MANUAL_PAYMENT_LIVE_NOTE);

    await ensureContract(db, ORDER_ID);

    expect(bytesAskedFor()).toEqual([FIRM_SIGNATURE_KEY]);
    const options = generateContractPdf.mock.calls[0][2];
    expect(Array.from(options.signature as Uint8Array)).toEqual(Array.from(SIGNATURE_PNG));
    expect(options.specimen).toBeUndefined();
  });

  it("does not take another order's record for this one", async () => {
    tables.user_services[0].stripe_checkout_session_id = null;
    tables.user_service_events = [{ id: "e1", user_service_id: "another-order", to_stage: "documents", note: MANUAL_PAYMENT_LIVE_NOTE }];

    await ensureContract(db, ORDER_ID);

    expect(bytesAskedFor()).not.toContain(FIRM_SIGNATURE_KEY);
    expect(generateContractPdf.mock.calls[0][2]).toEqual({ reference: ORDER_ID, signature: null, specimen: true });
  });

  it("fails before anything is written when the payment record cannot be read", async () => {
    paidOutside(MANUAL_PAYMENT_LIVE_NOTE);
    failures.push({ table: "user_service_events", op: "select", message: "user_service_events is down" });

    await expect(ensureContract(db, ORDER_ID)).rejects.toThrow("user_service_events is down");

    expect(generateContractPdf).not.toHaveBeenCalled();
    expect(putObject).not.toHaveBeenCalled();
    expect(tables.user_service_contracts).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("stays off when the admin regenerates a test order's agreement", async () => {
    tables.user_services[0].stripe_checkout_session_id = TEST_SESSION;
    tables.user_service_contracts = [contractRow()];

    const result = await regenerateContract(db, ORDER_ID);

    expect(result.contract.version).toBe(2);
    expect(bytesAskedFor()).not.toContain(FIRM_SIGNATURE_KEY);
    expect(generateContractPdf.mock.calls[0][2]).toEqual({ reference: ORDER_ID, signature: null, specimen: true });
  });
});

describe("regenerateContract", () => {
  it("writes a new version under a new key, updates the row and emails again", async () => {
    tables.user_service_contracts = [contractRow()];
    tables.user_service_applicants = [applicant({ full_name: "Jane Alice Doe Smith" })];

    const result = await regenerateContract(db, ORDER_ID, { origin: ORIGIN });

    expect(putObject).toHaveBeenCalledTimes(1);
    expect(putObject.mock.calls[0][0]).toMatchObject({
      key: versionKey(2),
      contentType: "application/pdf",
    });
    expect(buildContractValues.mock.calls[0][0].applicants[0].full_name).toBe("Jane Alice Doe Smith");

    const update = writes.find((w) => w.op === "update" && "version" in w.payload);
    expect(update?.payload).toMatchObject({
      template: "nif",
      version: 2,
      storage_key: putObject.mock.calls[0][0].key,
      size_bytes: PDF_BYTES.byteLength,
      emailed_at: null,
    });
    expect(tables.user_service_contracts).toHaveLength(1);
    expect(stored()?.id).toBe(contractRow().id);
    expect(stored()?.version).toBe(2);
    expect(stored()?.variables).toMatchObject({ "[FULL NAME]": "Jane Alice Doe Smith" });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe("client@example.com");
    expect(Array.from(sendEmail.mock.calls[0][0].attachments[0].content as Uint8Array)).toEqual(Array.from(PDF_BYTES));
    expect(result.emailed).toBe(true);
    expect(result.contract.version).toBe(2);
    expect(typeof stored()?.emailed_at).toBe("string");
    expect(stored()?.emailed_at).not.toBe(contractRow().emailed_at);
  });

  it("carries over the place printed last time, and none when none was printed", async () => {
    tables.user_service_contracts = [contractRow()];
    await regenerateContract(db, ORDER_ID);
    expect(buildContractValues.mock.calls[0][0].signingPlace).toBe("Austin, USA");

    // buildContractValues leaves the token out when the client typed no place.
    tables.user_service_contracts = [contractRow({ variables: { "[FULL NAME]": "Jane Alice Doe" } })];
    await regenerateContract(db, ORDER_ID);
    expect(buildContractValues.mock.calls[1][0].signingPlace).toBeNull();
  });

  it("uses the service's model now, and the row's when the service lost its own", async () => {
    tables.user_service_contracts = [contractRow()];
    tables.services[0].contract_template = "package";
    await regenerateContract(db, ORDER_ID);
    expect(generateContractPdf.mock.calls[0][0]).toBe("package");
    expect(stored()?.template).toBe("package");

    tables.services[0].contract_template = null;
    await regenerateContract(db, ORDER_ID);
    expect(generateContractPdf.mock.calls[1][0]).toBe("package");
    expect(stored()?.version).toBe(3);
  });

  it("prepares the first version when the order has none yet", async () => {
    const result = await regenerateContract(db, ORDER_ID, { origin: ORIGIN });

    expect(result.contract.version).toBe(1);
    expect(result.emailed).toBe(true);
    expect(putObject.mock.calls[0][0].key).toEqual(versionKey(1));
    expect(buildContractValues.mock.calls[0][0].signingPlace).toBeNull();
  });

  it("keeps the new version and reports the email that did not go out", async () => {
    tables.user_service_contracts = [contractRow()];
    sendEmail.mockResolvedValueOnce({ ok: false });

    const result = await regenerateContract(db, ORDER_ID);

    expect(result.emailed).toBe(false);
    expect(stored()?.version).toBe(2);
    expect(stored()?.emailed_at).toBeNull();
  });

  it("lets only one of two regenerations at once win", async () => {
    tables.user_service_contracts = [contractRow()];
    // The other admin's update lands while this one is uploading.
    putObject.mockImplementationOnce(async () => {
      tables.user_service_contracts[0].version = 2;
    });

    const error = await regenerateContract(db, ORDER_ID).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ContractError);
    expect(error).toMatchObject({ code: "stale", status: 409 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("answers with a line the admin may read when there is nothing to regenerate from", async () => {
    await expect(regenerateContract(db, "00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({
      name: "ContractError",
      code: "order_not_found",
      status: 404,
    });

    tables.services[0].contract_template = null;
    await expect(regenerateContract(db, ORDER_ID)).rejects.toMatchObject({ code: "no_template", status: 404 });

    seed();
    tables.user_services[0].paid_at = null;
    await expect(regenerateContract(db, ORDER_ID)).rejects.toMatchObject({
      code: "unpaid",
      status: 409,
      message: "Payment first.",
    });

    seed();
    tables.user_service_applicants = [];
    await expect(regenerateContract(db, ORDER_ID)).rejects.toMatchObject({
      code: "details_missing",
      status: 409,
      message: "The client has not entered their details yet.",
    });

    seed();
    seedCouple();
    tables.user_service_applicants = [applicant()];
    await expect(regenerateContract(db, ORDER_ID)).rejects.toMatchObject({
      code: "details_missing",
      status: 409,
      message: "The client has not entered their partner's details yet.",
    });

    expect(writes).toHaveLength(0);
    expect(putObject).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("reads the firm's signature again, so a regeneration after it arrived carries it", async () => {
    tables.user_service_contracts = [contractRow()];
    bucket(SIGNATURE_PNG);

    const result = await regenerateContract(db, ORDER_ID, { origin: ORIGIN });

    expect(result.contract.version).toBe(2);
    expect(getObjectBytes).toHaveBeenCalledWith(FIRM_SIGNATURE_KEY);
    expect(Array.from(generateContractPdf.mock.calls[0][2].signature as Uint8Array)).toEqual(Array.from(SIGNATURE_PNG));
  });

  it("regenerates the Couple package's agreement with both people", async () => {
    seedCouple();
    tables.user_service_contracts = [contractRow({ template: "couple" })];

    const result = await regenerateContract(db, ORDER_ID);

    expect(result.contract.version).toBe(2);
    expect(buildContractValues.mock.calls[0][0].applicants).toEqual([applicant(), partnerRow()]);
    expect(generateContractPdf.mock.calls[0][0]).toBe("couple");
    expect(stored()?.template).toBe("couple");
  });
});
