import { inflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  ATTORNEY,
  buildPowerOfAttorney,
  formatDeedDate,
  isJointPrincipals,
  signingDateFor,
  type JointPrincipals,
  type PoaBlock,
  type PrincipalDetails,
} from "@/content/power-of-attorney";
import { generatePowerOfAttorney, printable } from "./generate";

/**
 * Reads back the text pdf-lib wrote, one string per page. Strings are stored
 * as hex in the content stream, one per drawn line, so decoding them proves
 * the accents survived WinAnsi encoding rather than merely that a file was
 * produced.
 */
async function pageTexts(pdf: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(pdf);
  const pages: string[] = [];

  for (const page of doc.getPages()) {
    const lines: string[] = [];
    const contents = page.node.Contents();
    const streams =
      contents instanceof PDFArray
        ? contents.asArray().map((ref) => doc.context.lookup(ref))
        : [contents];

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
    pages.push(lines.join(" "));
  }
  return pages;
}

async function textOf(pdf: Uint8Array): Promise<string> {
  return (await pageTexts(pdf)).join(" ");
}

async function pageCount(pdf: Uint8Array): Promise<number> {
  return (await PDFDocument.load(pdf)).getPageCount();
}

/** Every string a deed prints, joined, for assertions on the built blocks. */
function wording(blocks: PoaBlock[]): string {
  return blocks
    .map((b) => (b.kind === "signature" ? b.name : `${b.pt} ${b.en}`))
    .join(" ");
}

const FILLED: PrincipalDetails = {
  fullName: "Jane Alice Doe",
  gender: "f",
  birthPlace: "Austin, Texas, United States of America",
  birthDate: "1984-07-04",
  passportNumber: "X1234567",
  passportIssuer: "United States Department of State",
  passportIssueDate: "2021-03-12",
  passportExpiryDate: "2031-03-11",
  taxAddress: "1200 West 6th Street, Apartment 14B, Austin, TX 78703, United States of America",
};

const SIGNED = { day: "12", monthPt: "março", monthEn: "March", year: "2026" };

/** The longest address the database accepts (400 characters) and a long name, the worst case for the page count. */
const LONG_ADDRESS =
  "Apartment 1408, Tower B, The Residences at Riverside Commons, 12345 North Lamar Boulevard, " +
  "Suite 200, Building 3, Austin, Travis County, Texas 78753, United States of America, " +
  "with correspondence care of The Wilkinson Family Trust, Post Office Box 98765, " +
  "Round Rock, Williamson County, Texas 78680, United States of America, and additional " +
  "notices to 4500 Cedar Bend Drive, Austin, Texas 78759, USA.";

const LONG_NAME = "Maria Alexandra Wilkinson de Albuquerque Ferreira Cavalcanti dos Santos";

/** A long name and the longest address: what a real client could plausibly enter. */
const WORST_CASE: PrincipalDetails = {
  ...FILLED,
  fullName: LONG_NAME,
  taxAddress: LONG_ADDRESS,
};

/** Repeats `seed` up to exactly `length` characters, ending on a letter. */
function fill(seed: string, length: number): string {
  const text = seed.repeat(Math.ceil(length / seed.length)).slice(0, length);
  return text.endsWith(" ") ? `${text.slice(0, -1)}x` : text;
}

/** Every text field at the SQL maximum (0007): the most a deed can be asked to carry. */
const MAXIMAL: PrincipalDetails = {
  ...FILLED,
  fullName: fill("Maria Alexandra Wilkinson de Albuquerque Ferreira Cavalcanti dos Santos e Silva ", 200),
  birthPlace: fill("San Sebastián de los Reyes, Comunidad de Madrid, Kingdom of Spain, Europe ", 200),
  passportNumber: fill("AB1234567890", 40),
  passportIssuer: fill("Ministry of Foreign Affairs and International Cooperation, Passport Office ", 200),
  taxAddress: fill(LONG_ADDRESS + " ", 400),
};

describe("power of attorney PDF", () => {
  it("is a valid A4 document", async () => {
    const pdf = await generatePowerOfAttorney("poa_nif");
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");

    const doc = await PDFDocument.load(pdf);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
    expect(Math.round(doc.getPage(0).getHeight())).toBe(842);
  });

  it("fits the blank NIF deed on one page", async () => {
    // One sheet: a deed that spills a lone signature onto page two looks broken.
    expect(await pageCount(await generatePowerOfAttorney("poa_nif"))).toBe(1);
  });

  it("fits the blank bank deed on at most two pages", async () => {
    expect(LONG_ADDRESS.length).toBeLessThanOrEqual(400);
    expect(await pageCount(await generatePowerOfAttorney("poa_bank"))).toBeLessThanOrEqual(2);
  });

  it("keeps a NIF deed with a 71 character name and a 400 character address on one page", async () => {
    expect(LONG_NAME.length).toBe(71);
    expect(LONG_ADDRESS.length).toBeLessThanOrEqual(400);
    expect(await pageCount(await generatePowerOfAttorney("poa_nif", WORST_CASE, SIGNED))).toBe(1);
  });

  it("keeps a bank deed with a 71 character name and a 400 character address on at most two pages", async () => {
    expect(await pageCount(await generatePowerOfAttorney("poa_bank", WORST_CASE, SIGNED))).toBeLessThanOrEqual(2);
  });

  it("renders every field at the SQL maximum without throwing, within one extra page", async () => {
    expect(MAXIMAL.fullName?.length).toBe(200);
    expect(MAXIMAL.birthPlace?.length).toBe(200);
    expect(MAXIMAL.passportNumber?.length).toBe(40);
    expect(MAXIMAL.passportIssuer?.length).toBe(200);
    expect(MAXIMAL.taxAddress?.length).toBe(400);

    const nif = await generatePowerOfAttorney("poa_nif", MAXIMAL, SIGNED);
    const bank = await generatePowerOfAttorney("poa_bank", MAXIMAL, SIGNED);
    expect(await pageCount(nif)).toBeLessThanOrEqual(2);
    expect(await pageCount(bank)).toBeLessThanOrEqual(3);
  });

  it("never leaves the signature alone on a page", async () => {
    // The closing line and the signature share the last page, whatever the fields hold.
    for (const kind of ["poa_nif", "poa_bank"] as const) {
      for (const principal of [undefined, FILLED, WORST_CASE, MAXIMAL]) {
        const pages = await pageTexts(await generatePowerOfAttorney(kind, principal, SIGNED));
        const last = pages[pages.length - 1];
        expect(last, `${kind} last page`).toContain("Fazendo fé");
        expect(last, `${kind} last page`).toContain("Lisboa");
      }
    }
  });

  it("keeps Portuguese accents intact through the font encoding", async () => {
    const text = await textOf(await generatePowerOfAttorney("poa_nif"));
    expect(text).toContain("Procuração");
    expect(text).toContain("Identificação Fiscal");
    expect(text).toContain("FINANÇAS");
  });

  it("carries both languages", async () => {
    const text = await textOf(await generatePowerOfAttorney("poa_nif"));
    expect(text).toContain("Power of Attorney");
    expect(text).toContain("Tax and Customs Authority");
    expect(text).toContain("shall lapse with the full execution");
  });

  it("prints the model's own placeholders when no data is supplied", async () => {
    const text = await textOf(await generatePowerOfAttorney("poa_nif"));
    expect(text).toContain("[NOME COMPLETO]");
    expect(text).toContain("[PLACE OF BIRTH]");
    expect(text).toContain("[DIA]");
    expect(text).toContain("nascido(a)");
  });

  it("substitutes supplied details on both language sides", async () => {
    const text = await textOf(await generatePowerOfAttorney("poa_nif", FILLED, SIGNED));
    expect(text).toContain("Jane Alice Doe");
    expect(text).toContain("X1234567");
    expect(text).toContain("março");
    expect(text).toContain("March");
    expect(text).not.toContain("[NOME COMPLETO]");
  });

  it("sets a subject per deed", async () => {
    const nif = await PDFDocument.load(await generatePowerOfAttorney("poa_nif"));
    const bank = await PDFDocument.load(await generatePowerOfAttorney("poa_bank"));
    expect(nif.getSubject()).toContain("NIF");
    expect(bank.getSubject()).toContain("conta bancária");
  });

  it("folds a name outside WinAnsi to its plain letters instead of throwing", async () => {
    const pdf = await generatePowerOfAttorney("poa_nif", { ...FILLED, fullName: "Nguyễn Văn Łukasz" }, SIGNED);
    const text = await textOf(pdf);
    expect(text).toContain("Nguyen Van Lukasz");
  });

  it("never prints a name half accented, in the paragraph or under the signature", async () => {
    // Letter by letter this printed "Lukasz Zólc": WinAnsi holds the o with acute and not the other three.
    const samples: [typed: string, printed: string][] = [
      ["Łukasz Żółć", "Lukasz Zolc"], // Polish
      ["Jiří Dvořák Růžička", "Jiri Dvorak Ruzicka"], // Czech
      ["İbrahim Şahin Çağlar", "Ibrahim Sahin Caglar"], // Turkish
      ["Ștefan Țăran", "Stefan Taran"], // Romanian
      ["Nguyễn Thị Đặng Hồng", "Nguyen Thi Dang Hong"], // Vietnamese
    ];
    for (const [typed, printed] of samples) {
      const text = await textOf(await generatePowerOfAttorney("poa_bank", { ...FILLED, fullName: typed }, SIGNED));
      // Portuguese paragraph, English paragraph, and the line under the signature.
      expect(text.split(printed).length - 1, typed).toBe(3);
      expect(text, typed).not.toContain("?");
    }
  });

  it("keeps the accents the fonts can print, also when they were typed as combining marks", async () => {
    const principal = { ...FILLED, fullName: "José António Conceição".normalize("NFD"), birthPlace: "São Paulo, Brasil" };
    const text = await textOf(await generatePowerOfAttorney("poa_nif", principal, SIGNED));
    expect(text).toContain("José António Conceição");
    expect(text).toContain("São Paulo, Brasil");
  });

  it("prepares the principal's fields and nothing else", () => {
    const polish = printable({ ...FILLED, fullName: "Łukasz Żółć", taxAddress: "ul. Żółkiewskiego 5, 31-539 Kraków" });
    expect(polish).toEqual({
      ...FILLED,
      fullName: "Lukasz Zolc",
      taxAddress: "ul. Zolkiewskiego 5, 31-539 Krakow",
    });
    expect(printable(FILLED)).toEqual(FILLED);
    expect(printable({})).toEqual({});
  });
});

describe("power of attorney content", () => {
  it("pairs every Portuguese block with an English one, in both deeds", () => {
    for (const kind of ["poa_nif", "poa_bank"] as const) {
      for (const block of buildPowerOfAttorney(kind)) {
        if (block.kind === "signature") continue;
        expect(block.pt.length, `PT missing on ${block.kind}`).toBeGreaterThan(0);
        expect(block.en.length, `EN missing on ${block.kind}`).toBeGreaterThan(0);
        expect(block.pt).not.toBe(block.en);
      }
    }
  });

  it("grants the two numbered powers of the NIF model", () => {
    const items = buildPowerOfAttorney("poa_nif").filter((b) => b.kind === "item");
    expect(items.map((i) => i.number)).toEqual(["1)", "2)"]);
    expect(items[0].pt).toContain("não atuará como gestora de bens ou direitos");
    expect(items[0].en).toContain("not act as a manager of assets or rights");
  });

  it("grants the five lettered powers of the bank model, then declares and lapses", () => {
    const blocks = buildPowerOfAttorney("poa_bank");
    const items = blocks.filter((b) => b.kind === "item");
    expect(items.map((i) => i.number)).toEqual(["a)", "b)", "c)", "d)", "e)"]);

    const after = blocks.slice(blocks.indexOf(items[4]) + 1);
    expect(after[0].kind).toBe("paragraph");
    expect(after[0].kind === "paragraph" && after[0].pt).toContain("Declara o Mandante");
    expect(after[1].kind === "paragraph" && after[1].en).toContain("shall lapse upon the full completion");
    expect(after[2].kind === "paragraph" && after[2].en).toContain("In witness whereof");
    expect(after[3].kind).toBe("signature");
  });

  it("states the attorney's credentials from the models, in both languages", () => {
    for (const kind of ["poa_nif", "poa_bank"] as const) {
      const [, opening] = buildPowerOfAttorney(kind);
      if (opening.kind !== "paragraph") throw new Error("expected the identification paragraph");
      for (const side of [opening.pt, opening.en]) {
        expect(side).toContain(ATTORNEY.name);
        expect(side).toContain(ATTORNEY.barNumber);
        expect(side).toContain(ATTORNEY.taxNumber);
        expect(side).toContain(ATTORNEY.phone);
        expect(side).toContain(ATTORNEY.email);
      }
      expect(opening.pt).toContain(ATTORNEY.address);
      expect(opening.pt).toContain("Ordem dos Advogados sob o n.º 65755L do Conselho Regional de Lisboa");
    }
  });

  it("leaves no bracket placeholder once every field is supplied", () => {
    for (const kind of ["poa_nif", "poa_bank"] as const) {
      const text = wording(buildPowerOfAttorney(kind, FILLED, SIGNED));
      expect(text).toContain("Jane Alice Doe");
      expect(text).not.toMatch(/\[[^\]]*\]/);
      expect(text).not.toContain("his/her");
      expect(text).not.toContain("he/she");
      expect(text).not.toContain("nascido(a)");
    }
  });

  it("reads as a template when nothing is supplied", () => {
    const text = wording(buildPowerOfAttorney("poa_bank"));
    for (const placeholder of [
      "[NOME COMPLETO]", "[LOCAL DE NASCIMENTO]", "[PLACE OF BIRTH]", "[DATA DE NASCIMENTO]",
      "[DATE OF BIRTH]", "[N.º DO PASSAPORTE]", "[ENTIDADE EMISSORA DO PASSAPORTE]",
      "[PASSPORT ISSUING AUTHORITY]", "[DATA DE EMISSÃO]", "[DATE OF ISSUE]", "[DATA DE VALIDADE]",
      "[EXPIRY DATE]", "[MORADA FISCAL]", "[TAX RESIDENCE ADDRESS]", "[DIA]", "[MÊS]", "[ANO]",
      "[DAY]", "[MONTH]", "[YEAR]",
    ]) {
      expect(text, placeholder).toContain(placeholder);
    }
    // The gender brackets resolve to both forms rather than staying bracketed.
    expect(text).toContain("nascido(a) em");
    expect(text).toContain("his/her lawful attorney");
    expect(text).toContain("to whom he/she grants");
  });

  it("uses the feminine forms for gender f", () => {
    const text = wording(buildPowerOfAttorney("poa_bank", { gender: "f" }));
    expect(text).toContain("nascida em");
    expect(text).toContain("appoints as her lawful attorney");
    expect(text).toContain("to whom she grants");
    expect(text).toContain("on her behalf, namely to:");
    expect(text).toContain("In her name and on her behalf");
    expect(text).toContain("close bank accounts in her name");
    expect(text).not.toMatch(/\bhis\b/);
    expect(text).not.toMatch(/\bhe\b/);
  });

  it("uses the masculine forms for gender m", () => {
    const text = wording(buildPowerOfAttorney("poa_bank", { gender: "m" }));
    expect(text).toContain("nascido em");
    expect(text).toContain("appoints as his lawful attorney");
    expect(text).toContain("to whom he grants");
    expect(text).toContain("In his name and on his behalf");
    expect(text).not.toContain("nascida");
    expect(text).not.toMatch(/\bher\b/);
    expect(text).not.toMatch(/\bshe\b/);
  });

  it("spells the three passport dates out per language and leaves other strings alone", () => {
    const text = wording(buildPowerOfAttorney("poa_nif", FILLED));
    expect(text).toContain("em 4 de julho de 1984");
    expect(text).toContain("on 4 July 1984");
    expect(text).toContain("em 12 de março de 2021, válido até 11 de março de 2031");
    expect(text).toContain("on 12 March 2021, valid until 11 March 2031");

    const free = wording(buildPowerOfAttorney("poa_nif", { birthDate: "4th of July, 1984" }));
    expect(free).toContain("em 4th of July, 1984");
  });

  it("prints the signing date in the model's line and the name under the signature", () => {
    const blocks = buildPowerOfAttorney("poa_nif", FILLED, SIGNED);
    const text = wording(blocks);
    expect(text).toContain("assinada em Lisboa no dia 12 de março de 2026.");
    expect(text).toContain("signed in Lisbon, on the 12 of March, 2026.");
    expect(blocks.at(-1)).toEqual({ kind: "signature", name: "Jane Alice Doe" });
  });
});

describe("formatDeedDate", () => {
  it("spells an ISO date out in Portuguese and English", () => {
    expect(formatDeedDate("2026-03-12", "pt")).toBe("12 de março de 2026");
    expect(formatDeedDate("2026-03-12", "en")).toBe("12 March 2026");
    expect(formatDeedDate("2026-01-05", "pt")).toBe("5 de janeiro de 2026");
    expect(formatDeedDate("1999-12-31", "en")).toBe("31 December 1999");
  });

  it("returns anything else as it came", () => {
    expect(formatDeedDate("12/03/2026", "pt")).toBe("12/03/2026");
    expect(formatDeedDate("2026-13-01", "en")).toBe("2026-13-01");
    expect(formatDeedDate("", "en")).toBe("");
  });
});

describe("signingDateFor", () => {
  it("reads the calendar in Lisbon, not in UTC", () => {
    // 23:30 UTC on 1 July is already 2 July in Lisbon (summer time, UTC+1).
    expect(signingDateFor(new Date("2026-07-01T23:30:00Z"))).toEqual({
      day: "2",
      monthPt: "julho",
      monthEn: "July",
      year: "2026",
    });
    // In March, before the clocks change, Lisbon is on UTC.
    expect(signingDateFor(new Date("2026-03-12T23:30:00Z"))).toEqual({
      day: "12",
      monthPt: "março",
      monthEn: "March",
      year: "2026",
    });
  });

  it("prints the day without a leading zero", () => {
    expect(signingDateFor(new Date("2026-09-05T12:00:00Z")).day).toBe("5");
  });
});

// ---------------------------------------------------------------------------
// The couple's joint bank deed (2026-09-25): one deed, both persons, two signatures
// ---------------------------------------------------------------------------

const PARTNER: PrincipalDetails = {
  fullName: "John Michael Doe",
  gender: "m",
  birthPlace: "Denver, Colorado, United States of America",
  birthDate: "1982-11-23",
  passportNumber: "Y7654321",
  passportIssuer: "United States Department of State",
  passportIssueDate: "2022-05-09",
  passportExpiryDate: "2032-05-08",
  taxAddress: "1200 West 6th Street, Apartment 14B, Austin, TX 78703, United States of America",
};

const COUPLE: JointPrincipals = [FILLED, PARTNER];

/** The blocks of a deed by their role, for comparing the joint deed with the single one. */
function byRole(blocks: PoaBlock[]) {
  return {
    items: blocks.filter((b) => b.kind === "item"),
    paragraphs: blocks.filter((b) => b.kind === "paragraph"),
    signatures: blocks.filter((b) => b.kind === "signature"),
  };
}

function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

describe("joint bank deed", () => {
  it("tells the pair apart from one principal", () => {
    expect(isJointPrincipals(COUPLE)).toBe(true);
    expect(isJointPrincipals(FILLED)).toBe(false);
    expect(isJointPrincipals({})).toBe(false);
  });

  it("names both persons, each with their own nascida or nascido, joined with e and and", () => {
    const [, opening] = buildPowerOfAttorney("poa_bank", COUPLE, SIGNED);
    if (opening.kind !== "paragraph") throw new Error("expected the identification paragraph");
    expect(opening.pt).toContain("Jane Alice Doe, nascida em Austin");
    expect(opening.pt).toContain(", e John Michael Doe, nascido em Denver");
    expect(opening.pt).toContain("titular do passaporte n.º X1234567");
    expect(opening.pt).toContain("titular do passaporte n.º Y7654321");
    expect(opening.en).toContain("Jane Alice Doe, born in Austin");
    expect(opening.en).toContain(", and John Michael Doe, born in Denver");
    expect(opening.en).toContain("on 23 November 1982");
  });

  it("speaks in the plural wherever the grammar asks", () => {
    const text = wording(buildPowerOfAttorney("poa_bank", COUPLE, SIGNED));
    for (const plural of [
      "constituem a sua bastante procuradora",
      "à qual conferem os poderes especiais necessários para:",
      "contratar seguros bancários em nome dos outorgantes;",
      "Assinar, em nome dos outorgantes, todos os formulários",
      "Declaram os Mandantes, de forma expressa",
      "gestora de bens ou direitos dos outorgantes,",
      "Mais declaram que os poderes conferidos",
      "instrumentos de investimento em nome dos outorgantes.",
      "hereby appoint as their lawful attorney",
      "to whom they grant, individually",
      "on their behalf, namely to:",
      "In their name and on their behalf",
      "close bank accounts in their name",
      "in the name of the principals;",
      "To sign, on behalf of the Principals, all forms",
      "The Principals expressly declare that",
      "a manager of the Principals’ assets",
      "The Principals further declare that",
      "investment instruments on behalf of the Principals.",
    ]) {
      expect(text, plural).toContain(plural);
    }
    for (const singular of [
      "constitui a sua",
      "à qual confere os",
      "do outorgante",
      "Declara o Mandante",
      "Mais declara que",
      "hereby appoints",
      "grants,",
      "Principal’s",
    ]) {
      expect(text, singular).not.toContain(singular);
    }
    expect(text).not.toMatch(/\b(his|her|he|she)\b/);
    expect(text).not.toMatch(/\b[Pp]rincipal\b/);
  });

  it("keeps clauses b) and d), the lapse clause and the closing line exactly as the single deed has them", () => {
    const single = byRole(buildPowerOfAttorney("poa_bank", FILLED, SIGNED));
    const joint = byRole(buildPowerOfAttorney("poa_bank", COUPLE, SIGNED));
    expect(joint.items.map((i) => i.number)).toEqual(["a)", "b)", "c)", "d)", "e)"]);
    expect(joint.items[1]).toEqual(single.items[1]);
    expect(joint.items[3]).toEqual(single.items[3]);
    expect(joint.items[3].kind === "item" && joint.items[3].pt).toContain("conta de titular único");
    // The paragraphs are the opening, the declaration, the lapse clause and the closing line.
    expect(joint.paragraphs).toHaveLength(4);
    expect(joint.paragraphs.slice(2)).toEqual(single.paragraphs.slice(2));
  });

  it("ends with the closing line, then one signature line per person, in applicant order", () => {
    const blocks = buildPowerOfAttorney("poa_bank", COUPLE, SIGNED);
    expect(blocks.slice(-2)).toEqual([
      { kind: "signature", name: "Jane Alice Doe" },
      { kind: "signature", name: "John Michael Doe" },
    ]);
    expect(blocks.at(-3)?.kind).toBe("paragraph");
    expect(byRole(blocks).signatures).toHaveLength(2);
  });

  it("prints both names in both languages and under both signature lines", async () => {
    const text = await textOf(await generatePowerOfAttorney("poa_bank", COUPLE, SIGNED));
    // Portuguese paragraph, English paragraph, and the line under each signature.
    expect(occurrences(text, "Jane Alice Doe")).toBe(3);
    expect(occurrences(text, "John Michael Doe")).toBe(3);
    expect(text).toContain("constituem a sua bastante procuradora");
    expect(text).toContain("hereby appoint as their lawful attorney");
  });

  it("keeps the closing line and both signatures together on the last page", async () => {
    const couples: JointPrincipals[] = [[{}, {}], COUPLE, [WORST_CASE, WORST_CASE], [MAXIMAL, MAXIMAL]];
    for (const couple of couples) {
      const pages = await pageTexts(await generatePowerOfAttorney("poa_bank", couple, SIGNED));
      const last = pages[pages.length - 1];
      expect(last).toContain("Fazendo fé");
      expect(last).toContain("In witness whereof");
      // The names appear on the last page only under the signature lines; a
      // long one wraps, so its first word is what is looked for.
      const [a, b] = couple.map((p) => (p.fullName ?? "[NOME COMPLETO]").split(" ")[0]);
      if (a === b) {
        expect(occurrences(last, a)).toBeGreaterThanOrEqual(2);
      } else {
        expect(occurrences(last, a)).toBeGreaterThanOrEqual(1);
        expect(occurrences(last, b)).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("fits on at most three pages, blank, filled, or with a long name and the longest address", async () => {
    expect(await pageCount(await generatePowerOfAttorney("poa_bank", [{}, {}]))).toBeLessThanOrEqual(3);
    expect(await pageCount(await generatePowerOfAttorney("poa_bank", COUPLE, SIGNED))).toBeLessThanOrEqual(3);
    expect(
      await pageCount(await generatePowerOfAttorney("poa_bank", [WORST_CASE, { ...WORST_CASE, gender: "m" }], SIGNED)),
    ).toBeLessThanOrEqual(3);
  });

  it("renders both persons at the SQL maximum without throwing, within one extra page", async () => {
    expect(await pageCount(await generatePowerOfAttorney("poa_bank", [MAXIMAL, MAXIMAL], SIGNED))).toBeLessThanOrEqual(4);
  });

  it("reads as a template for two when nothing is supplied", () => {
    const blocks = buildPowerOfAttorney("poa_bank", [{}, {}]);
    const [, opening] = blocks;
    if (opening.kind !== "paragraph") throw new Error("expected the identification paragraph");
    expect(occurrences(opening.pt, "[NOME COMPLETO]")).toBe(2);
    expect(occurrences(opening.pt, "nascido(a) em")).toBe(2);
    expect(occurrences(opening.en, "[TAX RESIDENCE ADDRESS]")).toBe(2);
    expect(blocks.slice(-2)).toEqual([
      { kind: "signature", name: "[NOME COMPLETO]" },
      { kind: "signature", name: "[NOME COMPLETO]" },
    ]);
  });

  it("prepares each person's fields for the fonts", async () => {
    const text = await textOf(
      await generatePowerOfAttorney("poa_bank", [FILLED, { ...PARTNER, fullName: "Łukasz Żółć" }], SIGNED),
    );
    expect(occurrences(text, "Lukasz Zolc")).toBe(3);
    expect(occurrences(text, "Jane Alice Doe")).toBe(3);
  });

  it("has no joint NIF deed: each person signs their own", async () => {
    expect(() => buildPowerOfAttorney("poa_nif", COUPLE)).toThrow(/Only the bank deed/);
    await expect(generatePowerOfAttorney("poa_nif", COUPLE)).rejects.toThrow(/Only the bank deed/);
  });

  it("refuses a template that is not a deed rather than print the NIF one", () => {
    // 0013 lets a slot carry 'agreement', the signed service agreement.
    expect(() => buildPowerOfAttorney("agreement" as unknown as "poa_nif")).toThrow(/No power of attorney/);
  });

  it("leaves the single bank deed in the singular, with one signature", () => {
    const blocks = buildPowerOfAttorney("poa_bank", FILLED, SIGNED);
    const text = wording(blocks);
    expect(text).toContain("constitui a sua bastante procuradora");
    expect(text).toContain("à qual confere os poderes");
    expect(text).toContain("Declara o Mandante");
    expect(text).toContain("em nome do outorgante.");
    expect(text).toContain("hereby appoints as her lawful attorney");
    expect(text).toContain("on behalf of the Principal.");
    expect(byRole(blocks).signatures).toHaveLength(1);
  });
});
