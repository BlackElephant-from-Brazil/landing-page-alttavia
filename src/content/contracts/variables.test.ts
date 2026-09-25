import { describe, expect, it } from "vitest";

import { CONTACT } from "@/content/bank-nif";
import type { UserServiceApplicantRow } from "@/lib/db/types";
import {
  APPLICANT_TOKENS,
  ContractValuesError,
  FIRM_CONSTANTS,
  KNOWN_TOKENS,
  PARTNER_TOKENS,
  buildContractValues,
  buildContractValuesFromFields,
  contractDrift,
  contractFileName,
  contractServiceLabel,
  partnerToken,
} from "./variables";

const APPLICANT: UserServiceApplicantRow = {
  id: "00000000-0000-4000-8000-000000000001",
  user_service_id: "00000000-0000-4000-8000-000000000002",
  applicant_index: 0,
  full_name: "Jane Alice Doe",
  gender: "f",
  birth_place: "Austin, Texas, United States of America",
  birth_date: "1984-07-04",
  passport_number: "X1234567",
  passport_issuer: "United States Department of State",
  passport_issued_on: "2021-03-12",
  passport_expires_on: "2031-03-11",
  tax_address: "1200 West 6th Street, Apartment 14B, Austin, TX 78703, United States of America",
  created_at: "2026-09-21T10:00:00Z",
  updated_at: "2026-09-21T10:00:00Z",
};

const FULL = {
  template: "nif",
  applicant: APPLICANT,
  email: "jane.doe@example.com",
  totalCents: 14900,
  paidAt: "2026-09-21T10:15:00Z",
  signingPlace: "Austin, United States",
} as const;

/** The partner of the Couple package: applicant 1. */
const PARTNER: UserServiceApplicantRow = {
  ...APPLICANT,
  id: "00000000-0000-4000-8000-000000000003",
  applicant_index: 1,
  full_name: "John Robert Doe",
  gender: "m",
  birth_place: "Denver, Colorado, United States of America",
  birth_date: "1982-11-23",
  passport_number: "Y7654321",
  passport_issued_on: "2022-05-02",
  passport_expires_on: "2032-05-01",
};

/** The shape ensure.ts passes: the order, the service, the applicants in applicant order. */
function orderInput(template: "nif" | "bank" | "package" | "couple", applicants: UserServiceApplicantRow[], totalCents = 14900) {
  return {
    order: { total_cents: totalCents, paid_at: "2026-09-21T10:15:00Z" },
    service: { slug: template, name: template, contract_template: template },
    applicants,
    email: "jane.doe@example.com",
    signingPlace: "Austin, United States",
  };
}

describe("buildContractValues from an order", () => {
  it("gives what the older shape gives, for every one person template", () => {
    for (const template of ["nif", "bank", "package"] as const) {
      expect(buildContractValues(orderInput(template, [APPLICANT]))).toEqual(buildContractValuesFromFields({ ...FULL, template }));
      // A partner row on a one person order is neither read nor printed.
      expect(buildContractValues(orderInput(template, [APPLICANT, PARTNER]))).toEqual(buildContractValuesFromFields({ ...FULL, template }));
    }
  });

  it("fills both persons of the Couple package, the partner under the 2 tokens", () => {
    const values = buildContractValues(orderInput("couple", [APPLICANT, PARTNER], 59700));
    expect(values).toEqual({
      "[FULL NAME]": "Jane Alice Doe",
      "[PLACE OF BIRTH]": "Austin, Texas, United States of America",
      "[DATE OF BIRTH]": "4 July 1984",
      "[PASSPORT NO.]": "X1234567",
      "[PASSPORT ISSUING AUTHORITY]": "United States Department of State",
      "[DATE OF ISSUE]": "12 March 2021",
      "[EXPIRY DATE]": "11 March 2031",
      "[TAX RESIDENCE ADDRESS]": "1200 West 6th Street, Apartment 14B, Austin, TX 78703, United States of America",
      "[FULL NAME 2]": "John Robert Doe",
      "[PLACE OF BIRTH 2]": "Denver, Colorado, United States of America",
      "[DATE OF BIRTH 2]": "23 November 1982",
      "[PASSPORT NO. 2]": "Y7654321",
      "[PASSPORT ISSUING AUTHORITY 2]": "United States Department of State",
      "[DATE OF ISSUE 2]": "2 May 2022",
      "[EXPIRY DATE 2]": "1 May 2032",
      "[TAX RESIDENCE ADDRESS 2]": "1200 West 6th Street, Apartment 14B, Austin, TX 78703, United States of America",
      "[EMAIL]": "jane.doe@example.com",
      "[TOTAL FEE]": "597",
      "[FEE IN WORDS]": "five hundred and ninety-seven",
      "[REPRESENTATION PERIOD]": "12 (twelve) months",
      "[NUMBER OF BANKS]": "1 (one)",
      "[DAY]": "21",
      "[MONTH]": "September",
      "[YEAR]": "2026",
      "[SERVICE: NIF / BANK ACCOUNT / NIF + BANK ACCOUNT PACKAGE]": "COUPLE PACKAGE",
      "[EMAIL OF THE SECOND PARTY]": CONTACT.email,
      "[PLACE]": "Austin, United States",
    });
  });

  it("spells the partner's values like the first person's", () => {
    const values = buildContractValues(orderInput("couple", [APPLICANT, { ...PARTNER, full_name: "  Łukasz   Żółć " }]));
    expect(values["[FULL NAME 2]"]).toBe("Lukasz Zolc");
  });

  it("refuses a Couple package agreement without the partner, whatever the shape", () => {
    expect(() => buildContractValues(orderInput("couple", [APPLICANT]))).toThrow(ContractValuesError);
    expect(() => buildContractValues(orderInput("couple", [APPLICANT]))).toThrow(/partner's details \(applicant 1\) are missing/);
    expect(() => buildContractValuesFromFields({ ...FULL, template: "couple" })).toThrow(ContractValuesError);
    expect(buildContractValuesFromFields({ ...FULL, template: "couple", partner: PARTNER })["[FULL NAME 2]"]).toBe("John Robert Doe");
  });

  it("refuses a service with no contract template", () => {
    const input = { ...orderInput("nif", [APPLICANT]), service: { slug: "nif-only", name: "NIF only", contract_template: null } };
    expect(() => buildContractValues(input)).toThrow(ContractValuesError);
  });

  it("leaves applicant 0's tokens out, bracketed in print, when there is no applicant", () => {
    const values = buildContractValues(orderInput("nif", []));
    for (const token of APPLICANT_TOKENS) expect(values[token]).toBeUndefined();
    expect(values["[TOTAL FEE]"]).toBe("149");
  });
});

describe("buildContractValues", () => {
  it("fills every token of the NIF contract and of Annex I", () => {
    expect(buildContractValuesFromFields(FULL)).toEqual({
      "[FULL NAME]": "Jane Alice Doe",
      "[PLACE OF BIRTH]": "Austin, Texas, United States of America",
      "[DATE OF BIRTH]": "4 July 1984",
      "[PASSPORT NO.]": "X1234567",
      "[PASSPORT ISSUING AUTHORITY]": "United States Department of State",
      "[DATE OF ISSUE]": "12 March 2021",
      "[EXPIRY DATE]": "11 March 2031",
      "[TAX RESIDENCE ADDRESS]": "1200 West 6th Street, Apartment 14B, Austin, TX 78703, United States of America",
      "[EMAIL]": "jane.doe@example.com",
      "[TOTAL FEE]": "149",
      "[FEE IN WORDS]": "one hundred and forty-nine",
      "[REPRESENTATION PERIOD]": "12 (twelve) months",
      "[DAY]": "21",
      "[MONTH]": "September",
      "[YEAR]": "2026",
      "[SERVICE: NIF / BANK ACCOUNT / NIF + BANK ACCOUNT PACKAGE]": "NIF",
      "[EMAIL OF THE SECOND PARTY]": CONTACT.email,
      "[PLACE]": "Austin, United States",
    });
  });

  it("gives each template the firm constants its model prints, and no other", () => {
    const nif = buildContractValuesFromFields({ ...FULL, template: "nif" });
    const bank = buildContractValuesFromFields({ ...FULL, template: "bank", totalCents: 39900 });
    const pack = buildContractValuesFromFields({ ...FULL, template: "package", totalCents: 49700 });

    expect(nif["[REPRESENTATION PERIOD]"]).toBe(FIRM_CONSTANTS.representationPeriod);
    expect(nif["[NUMBER OF BANKS]"]).toBeUndefined();

    expect(bank["[REPRESENTATION PERIOD]"]).toBeUndefined();
    expect(bank["[NUMBER OF BANKS]"]).toBe(FIRM_CONSTANTS.numberOfBanks);
    expect(bank["[TOTAL FEE]"]).toBe("399");
    expect(bank["[FEE IN WORDS]"]).toBe("three hundred and ninety-nine");

    expect(pack["[REPRESENTATION PERIOD]"]).toBe("12 (twelve) months");
    expect(pack["[NUMBER OF BANKS]"]).toBe("1 (one)");
    expect(pack["[FEE IN WORDS]"]).toBe("four hundred and ninety-seven");
    expect(pack["[SERVICE: NIF / BANK ACCOUNT / NIF + BANK ACCOUNT PACKAGE]"]).toBe("NIF + BANK ACCOUNT PACKAGE");
  });

  it("returns only tokens that have a value", () => {
    const values = buildContractValuesFromFields({
      template: "bank",
      applicant: null,
      email: null,
      totalCents: 39900,
      paidAt: null,
    });
    expect(Object.keys(values).sort()).toEqual(
      [
        "[TOTAL FEE]",
        "[FEE IN WORDS]",
        "[NUMBER OF BANKS]",
        "[SERVICE: NIF / BANK ACCOUNT / NIF + BANK ACCOUNT PACKAGE]",
        "[EMAIL OF THE SECOND PARTY]",
      ].sort(),
    );

    const blankPlace = buildContractValuesFromFields({ ...FULL, signingPlace: "   " });
    expect(blankPlace["[PLACE]"]).toBeUndefined();
    expect(buildContractValuesFromFields({ ...FULL, signingPlace: null })["[PLACE]"]).toBeUndefined();
    expect(buildContractValuesFromFields({ ...FULL, email: "  " })["[EMAIL]"]).toBeUndefined();
  });

  it("uses only tokens the list knows", () => {
    for (const template of ["nif", "bank", "package"] as const) {
      for (const token of Object.keys(buildContractValuesFromFields({ ...FULL, template }))) {
        expect(KNOWN_TOKENS, token).toContain(token);
      }
    }
  });

  it("dates the contract by the calendar in Lisbon, not in UTC", () => {
    // 23:30 UTC on 30 June is already 1 July in Lisbon (summer time, UTC+1).
    const summer = buildContractValuesFromFields({ ...FULL, paidAt: "2026-06-30T23:30:00Z" });
    expect([summer["[DAY]"], summer["[MONTH]"], summer["[YEAR]"]]).toEqual(["1", "July", "2026"]);

    // In winter Lisbon is on UTC: the same clock time stays on New Year's Eve.
    const winter = buildContractValuesFromFields({ ...FULL, paidAt: "2026-12-31T23:30:00Z" });
    expect([winter["[DAY]"], winter["[MONTH]"], winter["[YEAR]"]]).toEqual(["31", "December", "2026"]);

    // A timestamp with an offset, as Postgres returns it.
    const offset = buildContractValuesFromFields({ ...FULL, paidAt: "2026-09-05T08:00:00+00:00" });
    expect(offset["[DAY]"]).toBe("5");
  });

  it("leaves the date out when the payment date is missing or unreadable", () => {
    for (const paidAt of [null, "", "not a date"]) {
      const values = buildContractValuesFromFields({ ...FULL, paidAt });
      expect(values["[DAY]"]).toBeUndefined();
      expect(values["[MONTH]"]).toBeUndefined();
      expect(values["[YEAR]"]).toBeUndefined();
    }
  });

  it("prints a value on one line, trimmed", () => {
    const values = buildContractValuesFromFields({
      ...FULL,
      applicant: {
        ...APPLICANT,
        full_name: "  Jane   Alice\tDoe ",
        tax_address: "1200 West 6th Street\nApartment 14B\r\nAustin, TX 78703",
      },
      signingPlace: "  Austin,\n United States ",
    });
    expect(values["[FULL NAME]"]).toBe("Jane Alice Doe");
    expect(values["[TAX RESIDENCE ADDRESS]"]).toBe("1200 West 6th Street Apartment 14B Austin, TX 78703");
    expect(values["[PLACE]"]).toBe("Austin, United States");
  });

  it("spells a value in plain letters throughout once one letter is outside what the fonts hold", () => {
    const samples: [typed: string, printed: string][] = [
      ["Łukasz Żółć", "Lukasz Zolc"], // Polish
      ["Jiří Dvořák Růžička", "Jiri Dvorak Ruzicka"], // Czech
      ["İbrahim Şahin Çağlar", "Ibrahim Sahin Caglar"], // Turkish
      ["Ștefan Țăran", "Stefan Taran"], // Romanian
      ["Nguyễn Thị Đặng Hồng", "Nguyen Thi Dang Hong"], // Vietnamese
    ];
    for (const [typed, printed] of samples) {
      const values = buildContractValuesFromFields({ ...FULL, applicant: { ...APPLICANT, full_name: typed } });
      expect(values["[FULL NAME]"], typed).toBe(printed);
    }

    const values = buildContractValuesFromFields({
      ...FULL,
      applicant: {
        ...APPLICANT,
        birth_place: "Kraków, Polska",
        passport_issuer: "Wojewoda Małopolski",
        tax_address: "ul. Żółkiewskiego 5/7, 31-539 Kraków, Polska",
      },
      signingPlace: "Łódź, Polska",
    });
    // A value the fonts can spell keeps its accent; one they cannot loses all of them, never half.
    expect(values["[PLACE OF BIRTH]"]).toBe("Kraków, Polska");
    expect(values["[PASSPORT ISSUING AUTHORITY]"]).toBe("Wojewoda Malopolski");
    expect(values["[TAX RESIDENCE ADDRESS]"]).toBe("ul. Zolkiewskiego 5/7, 31-539 Krakow, Polska");
    expect(values["[PLACE]"]).toBe("Lodz, Polska");
  });

  it("keeps the accents the fonts can print, composed", () => {
    const values = buildContractValuesFromFields({
      ...FULL,
      applicant: { ...APPLICANT, full_name: "José António Conceição".normalize("NFD") },
    });
    expect(values["[FULL NAME]"]).toBe("José António Conceição".normalize("NFC"));
  });

  it("prints a date it cannot read as it came", () => {
    const values = buildContractValuesFromFields({ ...FULL, applicant: { ...APPLICANT, birth_date: "4th of July, 1984" } });
    expect(values["[DATE OF BIRTH]"]).toBe("4th of July, 1984");
  });

  it("prints cents when the order has them, and skips a fee that is not a number", () => {
    const cents = buildContractValuesFromFields({ ...FULL, totalCents: 14950 });
    expect(cents["[TOTAL FEE]"]).toBe("149.50");
    expect(cents["[FEE IN WORDS]"]).toBe("one hundred and forty-nine point five zero");

    const broken = buildContractValuesFromFields({ ...FULL, totalCents: Number.NaN });
    expect(broken["[TOTAL FEE]"]).toBeUndefined();
    expect(broken["[FEE IN WORDS]"]).toBeUndefined();
  });
});

describe("contractDrift", () => {
  const printed = buildContractValuesFromFields(FULL);

  it("is empty while the details still print what the agreement says", () => {
    expect(contractDrift(printed, "nif", APPLICANT)).toEqual([]);
  });

  it("does not look at timestamps: a save that changed nothing is no drift", () => {
    // The updated_at trigger fires on every save, changed or not.
    const resaved = { ...APPLICANT, updated_at: "2026-10-02T09:00:00Z", created_at: "2026-10-02T09:00:00Z" };
    expect(contractDrift(printed, "nif", resaved)).toEqual([]);
  });

  it("does not look at what the applicant does not fill: the fee, the dates of the contract, the place", () => {
    const other = buildContractValuesFromFields({ ...FULL, totalCents: 99900, paidAt: "2027-01-05T10:00:00Z", signingPlace: null, email: "x@example.com" });
    expect(contractDrift(other, "nif", APPLICANT)).toEqual([]);
    // The gender prints nowhere in the agreement.
    expect(contractDrift(printed, "nif", { ...APPLICANT, gender: "m" })).toEqual([]);
  });

  it("names each applicant token whose printed value changed, in the contract's order", () => {
    expect(contractDrift(printed, "nif", { ...APPLICANT, full_name: "Jane Alice Smith" })).toEqual(["[FULL NAME]"]);
    expect(contractDrift(printed, "nif", { ...APPLICANT, passport_expires_on: "2031-03-12" })).toEqual(["[EXPIRY DATE]"]);

    const moved = {
      ...APPLICANT,
      tax_address: "Rua do Alecrim 12, 1200-017 Lisboa, Portugal",
      passport_number: "Y7654321",
      passport_issuer: "U.S. Department of State",
      passport_issued_on: "2026-01-10",
      birth_place: "Dallas, Texas",
      birth_date: "1984-07-05",
    };
    expect(contractDrift(printed, "nif", moved)).toEqual([
      "[PLACE OF BIRTH]",
      "[DATE OF BIRTH]",
      "[PASSPORT NO.]",
      "[PASSPORT ISSUING AUTHORITY]",
      "[DATE OF ISSUE]",
      "[TAX RESIDENCE ADDRESS]",
    ]);
  });

  it("compares what is printed, so spacing and spelling the documents drop are no drift", () => {
    expect(contractDrift(printed, "nif", { ...APPLICANT, full_name: "  Jane   Alice Doe " })).toEqual([]);

    const polish = { ...APPLICANT, full_name: "Łukasz Żółć" };
    const printedPolish = buildContractValuesFromFields({ ...FULL, applicant: polish });
    expect(printedPolish["[FULL NAME]"]).toBe("Lukasz Zolc");
    expect(contractDrift(printedPolish, "nif", polish)).toEqual([]);
    expect(contractDrift(printedPolish, "nif", { ...polish, full_name: "Lukasz Zolc" })).toEqual([]);
  });

  it("answers the same for every template, and reads a value that was never printed as a change", () => {
    for (const template of ["nif", "bank", "package"] as const) {
      const values = buildContractValuesFromFields({ ...FULL, template });
      expect(contractDrift(values, template, APPLICANT)).toEqual([]);
      const without = { ...values };
      delete without["[PASSPORT NO.]"];
      expect(contractDrift(without, template, APPLICANT)).toEqual(["[PASSPORT NO.]"]);
    }
  });

  it("has nothing to say without details to compare with, or without a record of what was printed", () => {
    expect(contractDrift(printed, "nif", null)).toEqual([]);
    expect(contractDrift(null, "nif", APPLICANT)).toEqual([...APPLICANT_TOKENS]);
    expect(contractDrift({}, "nif", APPLICANT)).toEqual([...APPLICANT_TOKENS]);
  });

  it("knows the eight tokens the applicant fills, all of them known tokens", () => {
    expect(APPLICANT_TOKENS).toHaveLength(8);
    for (const token of APPLICANT_TOKENS) expect(KNOWN_TOKENS).toContain(token);
  });

  it("takes the applicants as a list, applicant 0 first", () => {
    expect(contractDrift(printed, "nif", [APPLICANT])).toEqual([]);
    expect(contractDrift(printed, "nif", [{ ...APPLICANT, full_name: "Jane Smith" }])).toEqual(["[FULL NAME]"]);
    expect(contractDrift(printed, "nif", [])).toEqual([]);
  });

  it("compares both persons of the Couple package, and only the first of any other", () => {
    const couple = buildContractValues(orderInput("couple", [APPLICANT, PARTNER]));
    expect(contractDrift(couple, "couple", [APPLICANT, PARTNER])).toEqual([]);
    expect(contractDrift(couple, "couple", [APPLICANT, { ...PARTNER, passport_number: "Z0000000" }])).toEqual(["[PASSPORT NO. 2]"]);
    expect(
      contractDrift(couple, "couple", [{ ...APPLICANT, full_name: "Jane Smith" }, { ...PARTNER, full_name: "John Smith" }]),
    ).toEqual(["[FULL NAME]", "[FULL NAME 2]"]);
    // Without the partner's row there is nothing to compare the partner's tokens with.
    expect(contractDrift(couple, "couple", APPLICANT)).toEqual([]);
    // A one person agreement never looks at a partner.
    expect(contractDrift(printed, "package", [APPLICANT, { ...PARTNER, full_name: "Someone Else" }])).toEqual([]);
  });
});

describe("the partner's tokens", () => {
  it("are the first person's with a 2, all known, in the same order", () => {
    expect(PARTNER_TOKENS).toEqual([
      "[FULL NAME 2]",
      "[PLACE OF BIRTH 2]",
      "[DATE OF BIRTH 2]",
      "[PASSPORT NO. 2]",
      "[PASSPORT ISSUING AUTHORITY 2]",
      "[DATE OF ISSUE 2]",
      "[EXPIRY DATE 2]",
      "[TAX RESIDENCE ADDRESS 2]",
    ]);
    expect(PARTNER_TOKENS).toEqual(APPLICANT_TOKENS.map(partnerToken));
    for (const token of PARTNER_TOKENS) expect(KNOWN_TOKENS).toContain(token);
  });
});

describe("KNOWN_TOKENS", () => {
  it("lists bracketed tokens, each once", () => {
    expect(new Set(KNOWN_TOKENS).size).toBe(KNOWN_TOKENS.length);
    for (const token of KNOWN_TOKENS) expect(token).toMatch(/^\[[^\[\]]+\]$/);
  });
});

describe("contractServiceLabel", () => {
  it("names the service as Annex I does", () => {
    expect(contractServiceLabel("nif")).toBe("NIF");
    expect(contractServiceLabel("bank")).toBe("BANK ACCOUNT");
    expect(contractServiceLabel("package")).toBe("NIF + BANK ACCOUNT PACKAGE");
    expect(contractServiceLabel("couple")).toBe("COUPLE PACKAGE");
  });
});

describe("contractFileName", () => {
  it("names the file after the template and the client", () => {
    expect(contractFileName("nif", "Jane Doe")).toBe("service-agreement-nif-jane-doe.pdf");
    expect(contractFileName("bank", "Jane Alice Doe")).toBe("service-agreement-bank-jane-alice-doe.pdf");
    expect(contractFileName("package", "João d'Ávila Conceição")).toBe("service-agreement-package-joao-d-avila-conceicao.pdf");
  });

  it("spells the name the way the agreement prints it, so a letter NFD cannot split is not lost", () => {
    expect(contractFileName("nif", "Łukasz Żółć")).toBe("service-agreement-nif-lukasz-zolc.pdf");
    expect(contractFileName("bank", "Nguyễn Thị Đặng")).toBe("service-agreement-bank-nguyen-thi-dang.pdf");
  });

  it("drops the name when there is none to keep", () => {
    expect(contractFileName("nif", null)).toBe("service-agreement-nif.pdf");
    expect(contractFileName("nif", "   ")).toBe("service-agreement-nif.pdf");
    expect(contractFileName("bank", "王小明")).toBe("service-agreement-bank.pdf");
  });

  it("is safe inside a header whatever was typed", () => {
    const hostile = contractFileName("nif", 'Jane "J"\r\nContent-Type: text/html; ../../etc/passwd');
    expect(hostile).toMatch(/^[a-z0-9.-]+$/);
    expect(hostile).not.toContain("..");
    expect(hostile.endsWith(".pdf")).toBe(true);
  });

  it("cuts a long name without ending on a dash", () => {
    const name = contractFileName("nif", "Maria Alexandra Wilkinson de Albuquerque Ferreira Cavalcanti dos Santos e Silva");
    expect(name.length).toBeLessThanOrEqual("service-agreement-nif-".length + 60 + ".pdf".length);
    expect(name).not.toMatch(/-\.pdf$/);
  });
});
