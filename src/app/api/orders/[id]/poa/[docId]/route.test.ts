import { inflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceDocRow, UserServiceApplicantRow, UserServiceRow } from "@/lib/db/types";

/**
 * GET /api/orders/[id]/poa/[docId] with the real deed builder, the real
 * applicant helpers and the real PDF generator behind it, against a fake
 * database; only the session and the admin client are stood in for.
 *
 * The case this file was written for is the couple's joint bank deed
 * (2026-09-25, migration 0016): one deed for both persons, `?applicant`
 * ignored, both applicant rows required, the refusal naming the first one
 * missing. The single deeds are checked alongside so the change is seen not
 * to reach them.
 */

type Row = Record<string, unknown>;

const { tables, session } = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  session: { user: null as { id: string; email: string; role: "client" | "admin" } | null },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin-user", () => ({ getUserWithRole: async () => session.user }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const filters: [string, unknown][] = [];
      const matching = () => (tables[table] ?? []).filter((row) => filters.every(([c, v]) => row[c] === v));
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return query;
        },
        maybeSingle() {
          const [row] = matching();
          return Promise.resolve({ data: row ? { ...row } : null, error: null });
        },
      };
      return query;
    },
  }),
}));

import { GET } from "./route";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const STRANGER_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN_ID = "55555555-5555-4555-8555-555555555555";
const COUPLE_SERVICE = "44444444-4444-4444-8444-444444444444";
const BANK_SERVICE = "66666666-6666-4666-8666-666666666666";
const COUPLE_ORDER = "33333333-3333-4333-8333-333333333333";
const BANK_ORDER = "77777777-7777-4777-8777-777777777777";
const JOINT_BANK_DOC = "d0000000-0000-4000-8000-000000000001";
const COUPLE_NIF_DOC = "d0000000-0000-4000-8000-000000000002";
const SINGLE_BANK_DOC = "d0000000-0000-4000-8000-000000000003";
const SHARED_BANK_DOC_ONE_PERSON = "d0000000-0000-4000-8000-000000000004";
const BASE = "http://localhost:3000";

const OWNER = { id: OWNER_ID, email: "client@example.com", role: "client" as const };
const STRANGER = { id: STRANGER_ID, email: "other@example.com", role: "client" as const };
const ADMIN = { id: ADMIN_ID, email: "info@alttavia-relocation.com", role: "admin" as const };

function order(id: string, serviceId: string, applicants: number, paid = true): Partial<UserServiceRow> {
  return {
    id,
    user_id: OWNER_ID,
    service_id: serviceId,
    joint: applicants === 2,
    applicants,
    paid_at: paid ? "2026-09-24T10:00:00.000Z" : null,
  };
}

function doc(id: string, serviceId: string, key: string, template: "poa_nif" | "poa_bank", perApplicant: boolean): Partial<ServiceDocRow> {
  return { id, service_id: serviceId, key, template, per_applicant: perApplicant, required: true };
}

function applicant(orderId: string, index: 0 | 1, fullName: string, gender: "f" | "m"): Partial<UserServiceApplicantRow> {
  return {
    id: crypto.randomUUID(),
    user_service_id: orderId,
    applicant_index: index,
    full_name: fullName,
    gender,
    birth_place: "Austin, Texas, United States of America",
    birth_date: "1984-07-04",
    passport_number: index === 0 ? "X1234567" : "Y7654321",
    passport_issuer: "United States Department of State",
    passport_issued_on: "2021-03-12",
    passport_expires_on: "2031-03-11",
    tax_address: "1200 West 6th Street, Austin, TX 78703, United States of America",
  };
}

const JANE = applicant(COUPLE_ORDER, 0, "Jane Alice Doe", "f");
const JOHN = applicant(COUPLE_ORDER, 1, "John Michael Doe", "m");

function get(orderId: string, docId: string, query = "") {
  return GET(new Request(`${BASE}/api/orders/${orderId}/poa/${docId}${query}`), {
    params: Promise.resolve({ id: orderId, docId }),
  });
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

function fileNameOf(response: Response): string | undefined {
  return /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1];
}

/** The text the PDF draws, all pages joined, decoded from the content streams. */
async function pdfText(response: Response): Promise<string> {
  const doc = await PDFDocument.load(new Uint8Array(await response.arrayBuffer()));
  const lines: string[] = [];
  for (const page of doc.getPages()) {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map((ref) => doc.context.lookup(ref)) : [contents];
    for (const stream of streams) {
      if (!(stream instanceof PDFRawStream)) continue;
      let buffer = Buffer.from(stream.asUint8Array());
      try {
        buffer = inflateSync(buffer);
      } catch {
        // Already uncompressed.
      }
      for (const [, hex] of buffer.toString("latin1").matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
        lines.push(Buffer.from(hex, "hex").toString("latin1"));
      }
    }
  }
  return lines.join(" ");
}

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  tables.user_services = [order(COUPLE_ORDER, COUPLE_SERVICE, 2), order(BANK_ORDER, BANK_SERVICE, 1)];
  tables.service_docs = [
    // The couple's bank deed after 0016: one shared slot.
    doc(JOINT_BANK_DOC, COUPLE_SERVICE, "poa_bank", "poa_bank", false),
    // The couple's NIF deed stays per applicant.
    doc(COUPLE_NIF_DOC, COUPLE_SERVICE, "poa_nif", "poa_nif", true),
    doc(SINGLE_BANK_DOC, BANK_SERVICE, "poa_bank", "poa_bank", true),
    // An admin may untick "per applicant" on a one person service: still a single deed.
    doc(SHARED_BANK_DOC_ONE_PERSON, BANK_SERVICE, "poa_bank_shared", "poa_bank", false),
  ];
  tables.user_service_applicants = [];
  session.user = OWNER;
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/orders/[id]/poa/[docId]: the couple's joint bank deed", () => {
  it("refuses with details_missing naming applicant 0 when nobody has entered details", async () => {
    const response = await get(COUPLE_ORDER, JOINT_BANK_DOC);
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toEqual({ error: "details_missing", applicant: 0 });
  });

  it("names applicant 1 when only the first person has entered details", async () => {
    tables.user_service_applicants = [JANE];
    const response = await get(COUPLE_ORDER, JOINT_BANK_DOC);
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toEqual({ error: "details_missing", applicant: 1 });
  });

  it("names applicant 0 when only the second person has entered details", async () => {
    tables.user_service_applicants = [JOHN];
    const response = await get(COUPLE_ORDER, JOINT_BANK_DOC, "?applicant=1");
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toEqual({ error: "details_missing", applicant: 0 });
  });

  it("returns one deed with both persons and a file name with both names", async () => {
    tables.user_service_applicants = [JANE, JOHN];
    const response = await get(COUPLE_ORDER, JOINT_BANK_DOC);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fileNameOf(response)).toBe("power-of-attorney-bank-jane-alice-doe-and-john-michael-doe.pdf");

    const text = await pdfText(response);
    // Portuguese paragraph, English paragraph, and the line under each signature.
    expect(text.split("Jane Alice Doe").length - 1).toBe(3);
    expect(text.split("John Michael Doe").length - 1).toBe(3);
    expect(text).toContain("constituem a sua bastante procuradora");
  });

  it("ignores ?applicant, whatever it says", async () => {
    tables.user_service_applicants = [JANE, JOHN];
    for (const query of ["?applicant=0", "?applicant=1", "?applicant=7", "?applicant=x"]) {
      const response = await get(COUPLE_ORDER, JOINT_BANK_DOC, query);
      expect(response.status, query).toBe(200);
      expect(fileNameOf(response), query).toBe("power-of-attorney-bank-jane-alice-doe-and-john-michael-doe.pdf");
    }
  });

  it("asks for payment first", async () => {
    tables.user_services = [order(COUPLE_ORDER, COUPLE_SERVICE, 2, false)];
    tables.user_service_applicants = [JANE, JOHN];
    const response = await get(COUPLE_ORDER, JOINT_BANK_DOC);
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toEqual({ error: "Payment first." });
  });

  it("serves an admin the same deed", async () => {
    session.user = ADMIN;
    tables.user_service_applicants = [JANE, JOHN];
    const response = await get(COUPLE_ORDER, JOINT_BANK_DOC, "?applicant=0");
    expect(response.status).toBe(200);
    expect(fileNameOf(response)).toBe("power-of-attorney-bank-jane-alice-doe-and-john-michael-doe.pdf");
  });

  it("answers a stranger as for any order that is not theirs", async () => {
    session.user = STRANGER;
    tables.user_service_applicants = [JANE, JOHN];
    const response = await get(COUPLE_ORDER, JOINT_BANK_DOC);
    expect(response.status).toBe(403);
    expect(await bodyOf(response)).toEqual({ error: "This order is not yours." });
  });

  it("sends a visitor without a session to login", async () => {
    session.user = null;
    const response = await get(COUPLE_ORDER, JOINT_BANK_DOC);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/en/login?next=/en/dashboard");
  });
});

describe("GET /api/orders/[id]/poa/[docId]: the single deeds are unchanged", () => {
  it("keeps the couple's NIF deed per applicant, naming the missing one", async () => {
    tables.user_service_applicants = [JANE];
    const missing = await get(COUPLE_ORDER, COUPLE_NIF_DOC, "?applicant=1");
    expect(missing.status).toBe(409);
    expect(await bodyOf(missing)).toEqual({ error: "details_missing", applicant: 1 });

    const response = await get(COUPLE_ORDER, COUPLE_NIF_DOC, "?applicant=0");
    expect(response.status).toBe(200);
    expect(fileNameOf(response)).toBe("power-of-attorney-nif-jane-alice-doe.pdf");
    const text = await pdfText(response);
    expect(text).not.toContain("John Michael Doe");
    expect(text).toContain("constitui a sua bastante procuradora");
  });

  it("builds Bank Account only's deed for its one person", async () => {
    const jane = { ...JANE, user_service_id: BANK_ORDER };
    tables.user_service_applicants = [jane];
    const response = await get(BANK_ORDER, SINGLE_BANK_DOC);
    expect(response.status).toBe(200);
    expect(fileNameOf(response)).toBe("power-of-attorney-bank-jane-alice-doe.pdf");
    const text = await pdfText(response);
    expect(text).toContain("constitui a sua bastante procuradora");
    expect(text.split("Jane Alice Doe").length - 1).toBe(3);
  });

  it("keeps a shared bank deed slot on a one person order a single deed", async () => {
    tables.user_service_applicants = [{ ...JANE, user_service_id: BANK_ORDER }];
    const response = await get(BANK_ORDER, SHARED_BANK_DOC_ONE_PERSON);
    expect(response.status).toBe(200);
    expect(fileNameOf(response)).toBe("power-of-attorney-bank-jane-alice-doe.pdf");
  });

  it("still refuses an applicant the slot does not have", async () => {
    tables.user_service_applicants = [{ ...JANE, user_service_id: BANK_ORDER }];
    for (const query of ["?applicant=1", "?applicant=x"]) {
      const response = await get(BANK_ORDER, SINGLE_BANK_DOC, query);
      expect(response.status, query).toBe(422);
      expect(await bodyOf(response)).toEqual({ error: "There is no applicant at that position." });
    }
  });

  it("never builds a deed for the signed agreement slot of 0013", async () => {
    const AGREEMENT_DOC = "d0000000-0000-4000-8000-000000000005";
    tables.service_docs.push({
      ...doc(AGREEMENT_DOC, COUPLE_SERVICE, "signed_agreement", "poa_bank", false),
      template: "agreement",
    });
    tables.user_service_applicants = [JANE, JOHN];
    const response = await get(COUPLE_ORDER, AGREEMENT_DOC);
    expect(response.status).toBe(404);
    expect(await bodyOf(response)).toEqual({ error: "This deed is not on record." });
  });

  it("refuses a deed of another service", async () => {
    tables.user_service_applicants = [JANE, JOHN];
    const response = await get(COUPLE_ORDER, SINGLE_BANK_DOC);
    expect(response.status).toBe(404);
    expect(await bodyOf(response)).toEqual({ error: "This deed is not on record." });
  });
});
