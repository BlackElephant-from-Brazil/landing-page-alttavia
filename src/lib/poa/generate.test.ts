import { inflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  ATTORNEY,
  buildPowerOfAttorney,
  formatDeedDate,
  signingDateFor,
  type PoaBlock,
  type PrincipalDetails,
} from "@/content/power-of-attorney";
import { generatePowerOfAttorney } from "./generate";

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
