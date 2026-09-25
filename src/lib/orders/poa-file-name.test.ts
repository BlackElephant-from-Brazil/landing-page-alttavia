import { describe, expect, it } from "vitest";

import { poaFileName } from "./applicants";

/**
 * poaFileName with the second name the couple's joint bank deed passes
 * (2026-09-25). The one name cases live in applicants.test.ts; this file
 * holds the two name ones so that file stays as it was.
 */
describe("poaFileName for the joint bank deed", () => {
  it("names both persons, joined with and", () => {
    expect(poaFileName("poa_bank", "Jane Alice Doe", "John Michael Doe")).toBe(
      "power-of-attorney-bank-jane-alice-doe-and-john-michael-doe.pdf",
    );
  });

  it("folds each name the way the deed prints it", () => {
    expect(poaFileName("poa_bank", "José María O'Connor-Ávila", "Łukasz Żółć")).toBe(
      "power-of-attorney-bank-jose-maria-o-connor-avila-and-lukasz-zolc.pdf",
    );
  });

  it("cuts each name on its own, never ending a part in a dash", () => {
    const long = "Maria Alexandra Wilkinson de Albuquerque Ferreira Cavalcanti dos Santos e Silva";
    const file = poaFileName("poa_bank", long, long);
    const [first, second] = file.replace(/^power-of-attorney-bank-/, "").replace(/\.pdf$/, "").split("-and-");
    expect(first.length).toBeLessThanOrEqual(60);
    expect(second.length).toBeLessThanOrEqual(60);
    expect(first).not.toMatch(/-$/);
    expect(file).not.toMatch(/-\.pdf$/);
  });

  it("leaves out a name with nothing to keep, and its and", () => {
    expect(poaFileName("poa_bank", "王小明", "John Michael Doe")).toBe("power-of-attorney-bank-john-michael-doe.pdf");
    expect(poaFileName("poa_bank", "Jane Alice Doe", "王小明")).toBe("power-of-attorney-bank-jane-alice-doe.pdf");
    expect(poaFileName("poa_bank", "王小明", "李娜")).toBe("power-of-attorney-bank.pdf");
  });

  it("prints the single deed's name as before when there is no second name", () => {
    expect(poaFileName("poa_bank", "Jane Alice Doe")).toBe("power-of-attorney-bank-jane-alice-doe.pdf");
    expect(poaFileName("poa_nif", "Jane Alice Doe", undefined)).toBe("power-of-attorney-nif-jane-alice-doe.pdf");
  });
});
