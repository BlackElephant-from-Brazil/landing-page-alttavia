import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BANK_DOCUMENTS,
  DEED_SIGNATURE_NOTE,
  EMPLOYMENT_DOCUMENTS,
  NIF_DOCUMENTS,
  needsBankQuestions,
  requiredDocuments,
} from "./documents";

describe("required documents", () => {
  it("asks a NIF only order for passport and proof of address", () => {
    const docs = requiredDocuments("nif-only");
    expect(docs.map((d) => d.label)).toEqual(["Passport", "Proof of address"]);
  });

  it("asks a bank only order for the bank's full set", () => {
    const labels = requiredDocuments("bank-only").map((d) => d.label);
    expect(labels).toContain("Portuguese tax identification number");
    expect(labels).toContain("Tax identification number from your country");
    expect(labels).toContain("Bank statements or annual income statement");
  });

  it("never asks for the same document twice on a bundle", () => {
    const labels = requiredDocuments("bundle").map((d) => `${d.group}:${d.label}`);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("swaps the proof of profession with the employment situation", () => {
    const employed = requiredDocuments("bundle", "employed").map((d) => d.label);
    const selfEmployed = requiredDocuments("bundle", "self-employed").map((d) => d.label);

    expect(employed).toContain("Employer statement or payslip");
    expect(employed).not.toContain("Commercial register excerpt");
    expect(selfEmployed).toContain("Commercial register excerpt");
    expect(selfEmployed).toContain("Annual tax return");
    expect(selfEmployed).not.toContain("Employer statement or payslip");
  });

  it("only asks the bank's written questions when an account is on the order", () => {
    expect(needsBankQuestions("bundle")).toBe(true);
    expect(needsBankQuestions("bank-only")).toBe(true);
    expect(needsBankQuestions("couple")).toBe(true);
    expect(needsBankQuestions("nif-only")).toBe(false);
  });
});

describe("requirements set by the authorities", () => {
  it("keeps the four corners rule on the NIF passport scan", () => {
    const passport = NIF_DOCUMENTS.find((d) => d.id === "nif-passport");
    expect(passport?.note).toContain("four corners");
  });

  it("keeps the different address windows: 3 months for the NIF, 6 for the bank", () => {
    expect(NIF_DOCUMENTS.find((d) => d.group === "address")?.note).toContain("3 months");
    expect(BANK_DOCUMENTS.find((d) => d.group === "address")?.note).toContain("6 months");
  });

  it("keeps the stamp and signature requirement on the employer statement", () => {
    const note = EMPLOYMENT_DOCUMENTS.employed[0].note ?? "";
    expect(note).toContain("letterhead");
    expect(note).toContain("stamped and signed");
  });

  it("asks every document from each applicant", () => {
    for (const doc of [...NIF_DOCUMENTS, ...BANK_DOCUMENTS]) {
      expect(doc.perApplicant, doc.id).toBe(true);
    }
  });
});

/**
 * The deed note is copy the client reads from `service_docs`, not from this
 * module: the row is written by supabase/migrations/0012_deed_signature_note.sql.
 * The constant is here as the seed source, so it is worth nothing unless the
 * two say the same thing. This pins them to each other.
 */
describe("deed signature note", () => {
  const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
  const MIGRATION = join(ROOT, "supabase", "migrations", "0012_deed_signature_note.sql");

  it("is the text the migration writes on every deed slot", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    const written = /set note = '([^']*)'/.exec(sql)?.[1];

    expect(written).toBe(DEED_SIGNATURE_NOTE);
    expect(sql).toContain("template in ('poa_nif', 'poa_bank')");
  });

  it("asks for the passport signature, which is the whole point of it", () => {
    expect(DEED_SIGNATURE_NOTE).toContain("same signature as in your passport");
  });
});
