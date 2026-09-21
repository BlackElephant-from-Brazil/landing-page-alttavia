import { describe, expect, it } from "vitest";

import { CONTACT } from "@/content/bank-nif";
import type { UserServiceApplicantRow } from "@/lib/db/types";
import {
  APPLICANT_TOKENS,
  FIRM_CONSTANTS,
  KNOWN_TOKENS,
  buildContractValues,
  contractDrift,
  contractFileName,
  contractServiceLabel,
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

describe("buildContractValues", () => {
  it("fills every token of the NIF contract and of Annex I", () => {
    expect(buildContractValues(FULL)).toEqual({
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
    const nif = buildContractValues({ ...FULL, template: "nif" });
    const bank = buildContractValues({ ...FULL, template: "bank", totalCents: 39900 });
    const pack = buildContractValues({ ...FULL, template: "package", totalCents: 49700 });

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
    const values = buildContractValues({
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

    const blankPlace = buildContractValues({ ...FULL, signingPlace: "   " });
    expect(blankPlace["[PLACE]"]).toBeUndefined();
    expect(buildContractValues({ ...FULL, signingPlace: null })["[PLACE]"]).toBeUndefined();
    expect(buildContractValues({ ...FULL, email: "  " })["[EMAIL]"]).toBeUndefined();
  });

  it("uses only tokens the list knows", () => {
    for (const template of ["nif", "bank", "package"] as const) {
      for (const token of Object.keys(buildContractValues({ ...FULL, template }))) {
        expect(KNOWN_TOKENS, token).toContain(token);
      }
    }
  });

  it("dates the contract by the calendar in Lisbon, not in UTC", () => {
    // 23:30 UTC on 30 June is already 1 July in Lisbon (summer time, UTC+1).
    const summer = buildContractValues({ ...FULL, paidAt: "2026-06-30T23:30:00Z" });
    expect([summer["[DAY]"], summer["[MONTH]"], summer["[YEAR]"]]).toEqual(["1", "July", "2026"]);

    // In winter Lisbon is on UTC: the same clock time stays on New Year's Eve.
    const winter = buildContractValues({ ...FULL, paidAt: "2026-12-31T23:30:00Z" });
    expect([winter["[DAY]"], winter["[MONTH]"], winter["[YEAR]"]]).toEqual(["31", "December", "2026"]);

    // A timestamp with an offset, as Postgres returns it.
    const offset = buildContractValues({ ...FULL, paidAt: "2026-09-05T08:00:00+00:00" });
    expect(offset["[DAY]"]).toBe("5");
  });

  it("leaves the date out when the payment date is missing or unreadable", () => {
    for (const paidAt of [null, "", "not a date"]) {
      const values = buildContractValues({ ...FULL, paidAt });
      expect(values["[DAY]"]).toBeUndefined();
      expect(values["[MONTH]"]).toBeUndefined();
      expect(values["[YEAR]"]).toBeUndefined();
    }
  });

  it("prints a value on one line, trimmed", () => {
    const values = buildContractValues({
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
      const values = buildContractValues({ ...FULL, applicant: { ...APPLICANT, full_name: typed } });
      expect(values["[FULL NAME]"], typed).toBe(printed);
    }

    const values = buildContractValues({
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
    const values = buildContractValues({
      ...FULL,
      applicant: { ...APPLICANT, full_name: "José António Conceição".normalize("NFD") },
    });
    expect(values["[FULL NAME]"]).toBe("José António Conceição".normalize("NFC"));
  });

  it("prints a date it cannot read as it came", () => {
    const values = buildContractValues({ ...FULL, applicant: { ...APPLICANT, birth_date: "4th of July, 1984" } });
    expect(values["[DATE OF BIRTH]"]).toBe("4th of July, 1984");
  });

  it("prints cents when the order has them, and skips a fee that is not a number", () => {
    const cents = buildContractValues({ ...FULL, totalCents: 14950 });
    expect(cents["[TOTAL FEE]"]).toBe("149.50");
    expect(cents["[FEE IN WORDS]"]).toBe("one hundred and forty-nine point five zero");

    const broken = buildContractValues({ ...FULL, totalCents: Number.NaN });
    expect(broken["[TOTAL FEE]"]).toBeUndefined();
    expect(broken["[FEE IN WORDS]"]).toBeUndefined();
  });
});

describe("contractDrift", () => {
  const printed = buildContractValues(FULL);

  it("is empty while the details still print what the agreement says", () => {
    expect(contractDrift(printed, "nif", APPLICANT)).toEqual([]);
  });

  it("does not look at timestamps: a save that changed nothing is no drift", () => {
    // The updated_at trigger fires on every save, changed or not.
    const resaved = { ...APPLICANT, updated_at: "2026-10-02T09:00:00Z", created_at: "2026-10-02T09:00:00Z" };
    expect(contractDrift(printed, "nif", resaved)).toEqual([]);
  });

  it("does not look at what the applicant does not fill: the fee, the dates of the contract, the place", () => {
    const other = buildContractValues({ ...FULL, totalCents: 99900, paidAt: "2027-01-05T10:00:00Z", signingPlace: null, email: "x@example.com" });
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
    const printedPolish = buildContractValues({ ...FULL, applicant: polish });
    expect(printedPolish["[FULL NAME]"]).toBe("Lukasz Zolc");
    expect(contractDrift(printedPolish, "nif", polish)).toEqual([]);
    expect(contractDrift(printedPolish, "nif", { ...polish, full_name: "Lukasz Zolc" })).toEqual([]);
  });

  it("answers the same for every template, and reads a value that was never printed as a change", () => {
    for (const template of ["nif", "bank", "package"] as const) {
      const values = buildContractValues({ ...FULL, template });
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
