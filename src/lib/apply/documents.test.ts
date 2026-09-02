import { describe, expect, it } from "vitest";

import {
  BANK_DOCUMENTS,
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

    expect(employed).toContain("Employer statement or pay slip");
    expect(employed).not.toContain("Commercial register excerpt");
    expect(selfEmployed).toContain("Commercial register excerpt");
    expect(selfEmployed).toContain("Annual tax return");
    expect(selfEmployed).not.toContain("Employer statement or pay slip");
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
