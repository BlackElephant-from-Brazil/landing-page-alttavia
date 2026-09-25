import { describe, expect, it } from "vitest";

import { CONTRACT_TEMPLATES, contractPersons, isContractTemplate } from "./templates";

describe("contract templates", () => {
  it("lists the firm's four models, the Couple package's last", () => {
    expect(CONTRACT_TEMPLATES).toEqual(["nif", "bank", "package", "couple"]);
  });

  it("recognises the four and nothing else", () => {
    for (const model of CONTRACT_TEMPLATES) expect(isContractTemplate(model)).toBe(true);
    for (const value of ["", "NIF", "Couple", "family", null, undefined, 1, ["nif"]]) {
      expect(isContractTemplate(value)).toBe(false);
    }
  });

  it("names two people for the Couple package and one for every other model", () => {
    expect(contractPersons("couple")).toBe(2);
    expect(contractPersons("nif")).toBe(1);
    expect(contractPersons("bank")).toBe(1);
    expect(contractPersons("package")).toBe(1);
    expect(contractPersons(null)).toBe(1);
    expect(contractPersons(undefined)).toBe(1);
  });
});
