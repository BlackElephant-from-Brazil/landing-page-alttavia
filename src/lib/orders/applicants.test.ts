import { describe, expect, it } from "vitest";

import type { Db } from "@/lib/db/queries";
import type { UserServiceApplicantRow } from "@/lib/db/types";

import {
  findApplicant,
  findPrefill,
  poaFileName,
  toPrincipal,
  upsertApplicant,
  validateApplicantInput,
} from "./applicants";

/** A fixed "today" in Lisbon, so the age and expiry rules are deterministic. */
const TODAY = "2026-09-14";

const VALID = {
  fullName: "  Jane Alice Doe ",
  gender: "f",
  birthPlace: "Austin, Texas, United States of America",
  birthDate: "1984-07-04",
  passportNumber: "X1234567",
  passportIssuer: "United States Department of State",
  passportIssueDate: "2021-03-12",
  passportExpiryDate: "2031-03-11",
  taxAddress: "1200 West 6th Street, Austin, TX 78703, USA",
};

function check(overrides: Record<string, unknown>) {
  return validateApplicantInput({ ...VALID, ...overrides }, TODAY);
}

function message(overrides: Record<string, unknown>): string {
  const result = check(overrides);
  if (result.ok) throw new Error("expected a validation failure");
  expect(result.status).toBe(422);
  return result.message;
}

describe("validateApplicantInput", () => {
  it("trims and returns the columns to upsert", () => {
    const result = validateApplicantInput(VALID, TODAY);
    expect(result).toEqual({
      ok: true,
      value: {
        full_name: "Jane Alice Doe",
        gender: "f",
        birth_place: VALID.birthPlace,
        birth_date: "1984-07-04",
        passport_number: "X1234567",
        passport_issuer: VALID.passportIssuer,
        passport_issued_on: "2021-03-12",
        passport_expires_on: "2031-03-11",
        tax_address: VALID.taxAddress,
      },
    });
  });

  it("accepts the column names and the other camelCase spellings of the dates", () => {
    const result = validateApplicantInput(
      {
        full_name: "Jane Alice Doe",
        gender: "m",
        birth_place: VALID.birthPlace,
        birth_date: "1984-07-04",
        passport_number: "X1234567",
        passport_issuer: VALID.passportIssuer,
        passportIssuedOn: "2021-03-12",
        passportExpiresOn: "2031-03-11",
        tax_address: VALID.taxAddress,
      },
      TODAY,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.gender).toBe("m");
      expect(result.value.passport_issued_on).toBe("2021-03-12");
      expect(result.value.passport_expires_on).toBe("2031-03-11");
    }
  });

  it("rejects a body that is not an object", () => {
    for (const body of [null, "x", 42, ["a"]]) {
      const result = validateApplicantInput(body, TODAY);
      expect(result.ok).toBe(false);
    }
  });

  it("asks for each text field with the model's lengths", () => {
    expect(message({ fullName: "J" })).toBe("Enter your full name as it appears in your passport.");
    expect(message({ fullName: 7 })).toBe("Enter your full name as it appears in your passport.");
    expect(message({ fullName: "x".repeat(201) })).toBe("Keep it under 200 characters.");
    expect(check({ fullName: "x".repeat(200) }).ok).toBe(true);
    expect(message({ birthPlace: " " })).toBe("Enter your place of birth, city and country.");
    expect(message({ passportNumber: "12" })).toBe("Enter your passport number.");
    expect(message({ passportNumber: "1".repeat(41) })).toBe("Keep it under 40 characters.");
    expect(message({ passportIssuer: "" })).toBe("Enter the authority that issued your passport.");
    expect(message({ taxAddress: "1234" })).toBe("Enter your full tax residence address.");
    expect(message({ taxAddress: "x".repeat(401) })).toBe("Keep it under 400 characters.");
  });

  it("counts characters, not UTF-16 units, like the database", () => {
    // 200 astral characters are 400 UTF-16 units and still within the limit.
    expect(check({ fullName: "𝔘".repeat(200) }).ok).toBe(true);
  });

  it("requires the gender to be f or m", () => {
    expect(message({ gender: "x" })).toBe("Tell us how the deed should refer to you.");
    expect(message({ gender: undefined })).toBe("Tell us how the deed should refer to you.");
    expect(message({ gender: "F" })).toBe("Tell us how the deed should refer to you.");
  });

  it("parses dates as real calendar dates", () => {
    expect(message({ birthDate: "07/04/1984" })).toBe("Enter a valid date of birth.");
    expect(message({ birthDate: "1984-02-30" })).toBe("Enter a valid date of birth.");
    expect(message({ birthDate: "1984-13-01" })).toBe("Enter a valid date of birth.");
    expect(message({ birthDate: "0984-07-04" })).toBe("Enter a valid date of birth.");
    expect(message({ passportIssueDate: "2021-3-12" })).toBe("Enter a valid date of issue.");
    expect(message({ passportExpiryDate: "" })).toBe("Enter a valid expiry date.");
    expect(check({ birthDate: "1984-02-29" }).ok).toBe(true);
  });

  it("requires the principal to be 18 by today's date in Lisbon", () => {
    expect(check({ birthDate: "2008-09-14" }).ok).toBe(true);
    expect(message({ birthDate: "2008-09-15" })).toBe("You need to be 18 or older to sign the deed.");
    expect(message({ birthDate: "2030-01-01" })).toBe("You need to be 18 or older to sign the deed.");
    // Born on 29 February: 18 on 1 March of the eighteenth year.
    expect(validateApplicantInput({ ...VALID, birthDate: "2008-02-29" }, "2026-02-28").ok).toBe(false);
    expect(validateApplicantInput({ ...VALID, birthDate: "2008-02-29" }, "2026-03-01").ok).toBe(true);
  });

  it("keeps the passport dates in order and the passport current", () => {
    expect(message({ passportIssueDate: "2026-09-15" })).toBe("The date of issue cannot be in the future.");
    expect(check({ passportIssueDate: "2026-09-14" }).ok).toBe(true);
    expect(message({ passportIssueDate: "2021-03-12", passportExpiryDate: "2021-03-12" })).toBe(
      "The expiry date must be after the date of issue.",
    );
    expect(message({ passportIssueDate: "2021-03-12", passportExpiryDate: "2020-01-01" })).toBe(
      "The expiry date must be after the date of issue.",
    );
    expect(message({ passportIssueDate: "2016-09-01", passportExpiryDate: "2026-09-13" })).toBe(
      "Your passport has expired. Enter a valid passport.",
    );
    expect(check({ passportIssueDate: "2016-09-01", passportExpiryDate: "2026-09-14" }).ok).toBe(true);
  });

  it("reports the first failure in field order", () => {
    expect(message({ fullName: "", gender: "x", taxAddress: "" })).toBe(
      "Enter your full name as it appears in your passport.",
    );
  });
});

// ---------------------------------------------------------------------------
// The database helpers against a recording fake: what is called, with what.
// ---------------------------------------------------------------------------

type Call = { method: string; args: unknown[] };

function fakeDb(result: { data: unknown; error: { message: string } | null }) {
  const calls: Call[] = [];
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit", "upsert", "insert", "update"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  }
  for (const method of ["maybeSingle", "single"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return Promise.resolve(result);
    };
  }
  const db = {
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      return chain;
    },
  } as unknown as Db;
  return { db, calls };
}

const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "11111111-1111-4111-8111-111111111111";

function row(overrides: Partial<UserServiceApplicantRow> = {}): UserServiceApplicantRow {
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
    created_at: "2026-09-14T10:00:00.000Z",
    updated_at: "2026-09-14T10:00:00.000Z",
    ...overrides,
  };
}

describe("upsertApplicant", () => {
  it("upserts on the order and applicant pair and returns the stored row", async () => {
    const stored = row();
    const { db, calls } = fakeDb({ data: stored, error: null });
    const checked = validateApplicantInput(VALID, TODAY);
    if (!checked.ok) throw new Error(checked.message);

    const result = await upsertApplicant(db, ORDER_ID, 0, checked.value);

    expect(result).toEqual(stored);
    expect(calls[0]).toEqual({ method: "from", args: ["user_service_applicants"] });
    const upsert = calls.find((c) => c.method === "upsert");
    expect(upsert?.args[0]).toEqual({ user_service_id: ORDER_ID, applicant_index: 0, ...checked.value });
    expect(upsert?.args[1]).toEqual({ onConflict: "user_service_id,applicant_index" });
    expect(calls.map((c) => c.method)).toEqual(["from", "upsert", "select", "single"]);
  });

  it("throws on a database error", async () => {
    const { db } = fakeDb({ data: null, error: { message: "boom" } });
    const checked = validateApplicantInput(VALID, TODAY);
    if (!checked.ok) throw new Error(checked.message);
    await expect(upsertApplicant(db, ORDER_ID, 1, checked.value)).rejects.toThrow("upsertApplicant: boom");
  });
});

describe("findApplicant", () => {
  it("reads one slot of one order", async () => {
    const stored = row({ applicant_index: 1 });
    const { db, calls } = fakeDb({ data: stored, error: null });
    expect(await findApplicant(db, ORDER_ID, 1)).toEqual(stored);
    expect(calls.filter((c) => c.method === "eq").map((c) => c.args)).toEqual([
      ["user_service_id", ORDER_ID],
      ["applicant_index", 1],
    ]);
  });

  it("returns null when there is none", async () => {
    const { db } = fakeDb({ data: null, error: null });
    expect(await findApplicant(db, ORDER_ID, 0)).toBeNull();
  });
});

describe("findPrefill", () => {
  it("joins through the order's owner, newest first, and strips the join", async () => {
    const stored = row();
    const { db, calls } = fakeDb({ data: { ...stored, user_services: { user_id: USER_ID } }, error: null });

    const result = await findPrefill(db, USER_ID, 0);

    expect(result).toEqual(stored);
    expect(result).not.toHaveProperty("user_services");
    expect(calls.find((c) => c.method === "select")?.args[0]).toContain("user_services!inner(user_id)");
    expect(calls.filter((c) => c.method === "eq").map((c) => c.args)).toEqual([
      ["user_services.user_id", USER_ID],
      ["applicant_index", 0],
    ]);
    expect(calls.find((c) => c.method === "order")?.args).toEqual(["updated_at", { ascending: false }]);
    expect(calls.find((c) => c.method === "limit")?.args).toEqual([1]);
  });

  it("returns null when the user never entered details", async () => {
    const { db } = fakeDb({ data: null, error: null });
    expect(await findPrefill(db, USER_ID, 1)).toBeNull();
  });
});

describe("toPrincipal", () => {
  it("maps the columns to the deed builder's fields", () => {
    expect(toPrincipal(row())).toEqual({
      fullName: "Jane Alice Doe",
      gender: "f",
      birthPlace: "Austin, Texas, United States of America",
      birthDate: "1984-07-04",
      passportNumber: "X1234567",
      passportIssuer: "United States Department of State",
      passportIssueDate: "2021-03-12",
      passportExpiryDate: "2031-03-11",
      taxAddress: "1200 West 6th Street, Austin, TX 78703, USA",
    });
  });
});

describe("poaFileName", () => {
  it("names the deed after its kind and the principal", () => {
    expect(poaFileName("poa_nif", "Jane Alice Doe")).toBe("power-of-attorney-nif-jane-alice-doe.pdf");
    expect(poaFileName("poa_bank", "Jane Alice Doe")).toBe("power-of-attorney-bank-jane-alice-doe.pdf");
  });

  it("folds accents and punctuation to an ascii slug", () => {
    expect(poaFileName("poa_nif", "  José María O'Connor-Ávila ")).toBe("power-of-attorney-nif-jose-maria-o-connor-avila.pdf");
    // Marks are stripped; a letter with no decomposition (Ł) is dropped from the slug.
    expect(poaFileName("poa_bank", "Nguyễn Văn Łukasz")).toBe("power-of-attorney-bank-nguyen-van-ukasz.pdf");
  });

  it("drops the suffix when nothing of the name survives", () => {
    expect(poaFileName("poa_nif", "王小明")).toBe("power-of-attorney-nif.pdf");
  });

  it("cuts a very long name without ending in a dash", () => {
    const name = "Maria Alexandra Wilkinson de Albuquerque Ferreira Cavalcanti dos Santos e Silva";
    const file = poaFileName("poa_nif", name);
    expect(file.length).toBeLessThanOrEqual("power-of-attorney-nif-".length + 60 + ".pdf".length);
    expect(file).not.toMatch(/-\.pdf$/);
  });
});
