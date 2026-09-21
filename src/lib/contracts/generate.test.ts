import { inflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { CONTRACT_MODELS } from "@/content/contracts/models.generated";
import { buildContractValues, type ContractValues } from "@/content/contracts/variables";
import type { ContractTemplate, UserServiceApplicantRow } from "@/lib/db/types";
import { BLANK_RULE, contractBlocks, generateContractPdf, hasValues, substituteBlocks } from "./generate";

const TEMPLATES: ContractTemplate[] = ["nif", "bank", "package"];
const TOKEN = /\[[^\[\]]+\]/;

/** The standard fonts write WinAnsi, which is Windows-1252: the em dash and the euro sign live above Latin-1. */
const winAnsi = new TextDecoder("windows-1252");

/** The decoded content streams of every page, in order. */
async function pageStreams(pdf: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(pdf);
  return doc.getPages().map((page) => {
    const contents = page.node.Contents();
    const streams =
      contents instanceof PDFArray ? contents.asArray().map((ref) => doc.context.lookup(ref)) : [contents];
    let out = "";
    for (const stream of streams) {
      if (!(stream instanceof PDFRawStream)) continue;
      let buffer = Buffer.from(stream.asUint8Array());
      try {
        buffer = inflateSync(buffer);
      } catch {
        // Already uncompressed.
      }
      out += buffer.toString("latin1");
    }
    return out;
  });
}

/**
 * Reads back the text pdf-lib wrote: the lines of every page, top to bottom.
 * Every drawText is a text matrix and a hex string; runs on the same
 * baseline are one line, joined as drawn (a run carries its own trailing
 * space). The footer is the last line of each page.
 */
async function pageLines(pdf: Uint8Array): Promise<string[][]> {
  return (await pageStreams(pdf)).map((stream) => {
    const lines = new Map<string, { x: number; text: string }[]>();
    for (const [, x, y, hex] of stream.matchAll(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm\s*<([0-9A-Fa-f]*)> Tj/g)) {
      const key = Number(y).toFixed(2);
      const runs = lines.get(key) ?? [];
      runs.push({ x: Number(x), text: winAnsi.decode(Buffer.from(hex, "hex")) });
      lines.set(key, runs);
    }
    return [...lines.entries()]
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([, runs]) =>
        runs
          .sort((a, b) => a.x - b.x)
          .map((run) => run.text)
          .join(""),
      );
  });
}

/** One string per page, lines joined with a space. */
async function pageTexts(pdf: Uint8Array): Promise<string[]> {
  return (await pageLines(pdf)).map((lines) => lines.join(" "));
}

async function pageCount(pdf: Uint8Array): Promise<number> {
  return (await PDFDocument.load(pdf)).getPageCount();
}

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

const FEE: Record<ContractTemplate, number> = { nif: 14900, bank: 39900, package: 49700 };

function valuesFor(template: ContractTemplate, applicant: UserServiceApplicantRow = APPLICANT, place: string | null = "Austin, United States") {
  return buildContractValues({
    template,
    applicant,
    email: "jane.doe@example.com",
    totalCents: FEE[template],
    paidAt: "2026-09-21T10:15:00Z",
    signingPlace: place,
  });
}

/** The longest address the database accepts (400 characters) and a long name. */
const LONG_ADDRESS =
  "Apartment 1408, Tower B, The Residences at Riverside Commons, 12345 North Lamar Boulevard, " +
  "Suite 200, Building 3, Austin, Travis County, Texas 78753, United States of America, " +
  "with correspondence care of The Wilkinson Family Trust, Post Office Box 98765, " +
  "Round Rock, Williamson County, Texas 78680, United States of America, and additional " +
  "notices to 4500 Cedar Bend Drive, Austin, Texas 78759, USA.";

const LONG_NAME = "Maria Alexandra Wilkinson de Albuquerque Ferreira Cavalcanti dos Santos";

const WORST_CASE: UserServiceApplicantRow = { ...APPLICANT, full_name: LONG_NAME, tax_address: LONG_ADDRESS };

/** Repeats `seed` up to exactly `length` characters, ending on a letter. */
function fill(seed: string, length: number): string {
  const text = seed.repeat(Math.ceil(length / seed.length)).slice(0, length);
  return text.endsWith(" ") ? `${text.slice(0, -1)}x` : text;
}

/** Every text field at the SQL maximum (0007), one of them without a single space to break on. */
const MAXIMAL: UserServiceApplicantRow = {
  ...APPLICANT,
  full_name: fill("Maria Alexandra Wilkinson de Albuquerque Ferreira Cavalcanti dos Santos e Silva ", 200),
  birth_place: fill("San Sebastián de los Reyes, Comunidad de Madrid, Kingdom of Spain, Europe ", 200),
  passport_number: fill("AB1234567890", 40),
  passport_issuer: fill("MinistryOfForeignAffairsAndInternationalCooperationPassportOffice", 200),
  tax_address: fill(LONG_ADDRESS + " ", 400),
};

describe("contract values into blocks", () => {
  it("leaves no token that had a value, in the contract or in Annex I", () => {
    for (const template of TEMPLATES) {
      const values = valuesFor(template);
      const { contract, annex } = contractBlocks(template, values);
      for (const block of [...contract, ...annex]) {
        for (const token of Object.keys(values)) expect(block.text, `${template}: ${token}`).not.toContain(token);
      }
    }
  });

  it("leaves no bracket at all once every field is supplied", () => {
    for (const template of TEMPLATES) {
      const { contract, annex } = contractBlocks(template, valuesFor(template));
      for (const block of [...contract, ...annex]) expect(block.text, template).not.toMatch(TOKEN);
    }
  });

  it("prints the values where the models have the tokens", () => {
    const { contract, annex } = contractBlocks("nif", valuesFor("nif"));
    const text = [...contract, ...annex].map((b) => b.text).join("\n");
    expect(text).toContain(
      "Jane Alice Doe, born in Austin, Texas, United States of America, on 4 July 1984, of legal age, holder of " +
        "passport no. X1234567, issued by United States Department of State on 12 March 2021, valid until 11 March 2031, " +
        "tax resident at 1200 West 6th Street, Apartment 14B, Austin, TX 78703, United States of America, with email " +
        "address jane.doe@example.com, hereinafter referred to as the First Party or Client;",
    );
    expect(text).toContain("is €149 (one hundred and forty-nine euros), plus VAT");
    expect(text).toContain("for a period of 12 (twelve) months as from the assignment of the NIF");
    expect(text).toContain("Done in duplicate at Lisbon, on 21 September 2026.");
    expect(text).toContain("relating to NIF, dated 21 September 2026 (the \"Contract\")");
    expect(text).toContain("Place and date: Austin, United States, 21 September 2026");
    expect(text).toContain("Jane Alice Doe — Client");
    expect(text).toContain("Unipessoal Lda., at info@alttavia-relocation.com, by an unequivocal statement");

    const bank = contractBlocks("bank", valuesFor("bank")).contract.map((b) => b.text).join("\n");
    expect(bank).toContain("after 1 (one) institution(s) have refused or declined");
    expect(bank).toContain("is €399 (three hundred and ninety-nine euros)");

    const pack = contractBlocks("package", valuesFor("package"));
    expect(pack.contract.map((b) => b.text).join("\n")).toContain("is €497 (four hundred and ninety-seven euros)");
    expect(pack.annex.map((b) => b.text).join("\n")).toContain("relating to NIF + BANK ACCOUNT PACKAGE, dated");
  });

  it("reads as a template when nothing is supplied", () => {
    for (const template of TEMPLATES) {
      const { contract, annex } = contractBlocks(template, {});
      expect(contract).toEqual(CONTRACT_MODELS[template]);
      expect(annex).toEqual(CONTRACT_MODELS.annex);
    }
    const text = contractBlocks("nif", {}).annex.map((b) => b.text).join("\n");
    expect(text).toContain("Place and date: [PLACE], [DAY] [MONTH] [YEAR]");
    expect(hasValues({})).toBe(false);
    expect(hasValues({ "[FULL NAME]": "  " })).toBe(false);
  });

  it("keeps the bracket of a token that has no value, beside the ones that have", () => {
    const values = buildContractValues({ template: "nif", applicant: null, email: null, totalCents: 14900, paidAt: null });
    const text = contractBlocks("nif", values).contract.map((b) => b.text).join("\n");
    expect(text).toContain("[FULL NAME], born in [PLACE OF BIRTH]");
    expect(text).toContain("with email address [EMAIL]");
    expect(text).toContain("is €149 (one hundred and forty-nine euros)");
    expect(text).toContain("on [DAY] [MONTH] [YEAR].");
  });

  it("turns an empty place into a rule to fill by hand, but only in a contract that has values", () => {
    const annex = contractBlocks("nif", valuesFor("nif", APPLICANT, null)).annex.map((b) => b.text).join("\n");
    expect(annex).toContain(`Place and date: ${BLANK_RULE}, 21 September 2026`);
    expect(annex).not.toContain("[PLACE]");
  });

  it("moves the bold with the text: a value takes the face of its token", () => {
    const { contract } = contractBlocks("nif", valuesFor("nif", WORST_CASE));
    const parties = contract[3];
    expect(parties.bold?.map(([s, e]) => parties.text.slice(s, e))).toEqual([LONG_NAME]);

    const fee = contract.find((b) => b.text.includes("€149"));
    expect(fee?.bold?.map(([s, e]) => fee.text.slice(s, e))).toEqual(["€149 (one hundred and forty-nine euros)"]);

    // Bold after a replaced token moves along with it.
    const annexFirst = contractBlocks("nif", valuesFor("nif")).annex[3];
    expect(annexFirst.bold?.map(([s, e]) => annexFirst.text.slice(s, e))).toEqual([
      "Jane Alice Doe",
      "X1234567",
      "ALTTAVIA RELOCATION, Unipessoal Lda.",
      "NIF",
      "21 September 2026",
    ]);
  });

  it("replaces in one pass, so a value that looks like a token stays as typed", () => {
    const values: ContractValues = { "[FULL NAME]": "[EMAIL]", "[EMAIL]": "jane.doe@example.com" };
    const [block] = substituteBlocks([{ kind: "plain", text: "[FULL NAME], with email address [EMAIL]" }], values);
    expect(block.text).toBe("[EMAIL], with email address jane.doe@example.com");
  });

  it("does not touch the models", () => {
    const before = JSON.stringify(CONTRACT_MODELS);
    contractBlocks("package", valuesFor("package", MAXIMAL));
    expect(JSON.stringify(CONTRACT_MODELS)).toBe(before);
  });
});

describe("contract PDF", () => {
  it("is a valid A4 document with its properties set", async () => {
    const pdf = await generateContractPdf("nif", {});
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");

    const doc = await PDFDocument.load(pdf);
    for (const page of doc.getPages()) {
      expect(Math.round(page.getWidth())).toBe(595);
      expect(Math.round(page.getHeight())).toBe(842);
    }
    expect(doc.getTitle()).toBe("Contract for Legal Services");
    expect(doc.getSubject()).toContain("NIF");
    expect((await PDFDocument.load(await generateContractPdf("bank", {}))).getSubject()).toContain("Bank Account");
  });

  it("stays within the page counts the layout was tuned for, blank or filled", async () => {
    const limit: Record<ContractTemplate, number> = { nif: 11, bank: 11, package: 12 };
    for (const template of TEMPLATES) {
      expect(await pageCount(await generateContractPdf(template, {})), `${template} blank`).toBeLessThanOrEqual(limit[template]);
      expect(await pageCount(await generateContractPdf(template, valuesFor(template))), `${template} filled`).toBeLessThanOrEqual(
        limit[template],
      );
    }
  });

  it("carries a long name and a 400 character address in at most one more page", async () => {
    expect(LONG_NAME.length).toBe(71);
    expect(LONG_ADDRESS.length).toBeLessThanOrEqual(400);
    for (const template of TEMPLATES) {
      const usual = await pageCount(await generateContractPdf(template, valuesFor(template)));
      const worst = await pageCount(await generateContractPdf(template, valuesFor(template, WORST_CASE)));
      expect(worst - usual, template).toBeLessThanOrEqual(1);
    }
  });

  it("renders every field at the SQL maximum, unbroken words included, inside the margins", async () => {
    expect(MAXIMAL.full_name.length).toBe(200);
    expect(MAXIMAL.passport_issuer.length).toBe(200);
    expect(MAXIMAL.passport_issuer).not.toContain(" ");
    expect(MAXIMAL.tax_address.length).toBe(400);

    const pdf = await generateContractPdf("package", valuesFor("package", MAXIMAL), { reference: "Order 1234" });
    const usual = await pageCount(await generateContractPdf("package", valuesFor("package")));
    expect((await pageCount(pdf)) - usual).toBeLessThanOrEqual(1);

    // No line starts left of the margin or below the footer; the text column ends at 529 pt.
    for (const stream of await pageStreams(pdf)) {
      for (const [, x, y] of stream.matchAll(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/g)) {
        expect(Number(x)).toBeGreaterThanOrEqual(65.9);
        expect(Number(x)).toBeLessThan(529.3);
        expect(Number(y)).toBeGreaterThanOrEqual(37.9);
        expect(Number(y)).toBeLessThan(800);
      }
    }
    const text = (await pageTexts(pdf)).join(" ").replace(/\s+/g, "");
    expect(text).toContain(MAXIMAL.passport_issuer);
  });

  it("starts Annex I on a new page, after the signatures", async () => {
    for (const template of TEMPLATES) {
      const pages = await pageTexts(await generateContractPdf(template, valuesFor(template)));
      const annex = pages.findIndex((page) => page.startsWith("ANNEX I "));
      expect(annex, template).toBeGreaterThan(0);
      expect(pages[annex - 1], template).toContain("For and on behalf of ALTTAVIA RELOCATION, Unipessoal Lda.");
      // Parts B and C open their own pages, as in the model.
      expect(pages[annex + 1].startsWith("PART B — INFORMATION ON THE RIGHT OF WITHDRAWAL"), template).toBe(true);
      expect(pages[annex + 2].startsWith("PART C — WITHDRAWAL FORM"), template).toBe(true);
      expect(pages).toHaveLength(annex + 3);
    }
  });

  it("keeps the signature block on the page of the Done in duplicate line", async () => {
    for (const template of TEMPLATES) {
      for (const values of [{}, valuesFor(template), valuesFor(template, WORST_CASE), valuesFor(template, MAXIMAL)]) {
        const pages = await pageTexts(await generateContractPdf(template, values));
        const closing = pages.filter((page) => page.includes("Done in duplicate at Lisbon"));
        expect(closing, template).toHaveLength(1);
        for (const line of [
          "SIGNATURES",
          "The First Party,",
          "The Second Party,",
          "PATRÍCIA SOARES VIANA",
          "For and on behalf of ALTTAVIA RELOCATION, Unipessoal Lda.",
        ]) {
          expect(closing[0], `${template}: ${line}`).toContain(line);
        }
      }
    }
  });

  it("never leaves a heading at the foot of a page, away from what it heads", async () => {
    for (const template of TEMPLATES) {
      const headings = new Set(
        [...CONTRACT_MODELS[template], ...CONTRACT_MODELS.annex]
          .filter((b) => b.kind === "clause" || b.kind === "clauseTitle" || b.kind === "partHeading")
          .map((b) => b.text),
      );
      for (const values of [{}, valuesFor(template), valuesFor(template, WORST_CASE), valuesFor(template, MAXIMAL)]) {
        for (const lines of await pageLines(await generateContractPdf(template, values))) {
          // The footer is the last line; the one before it is the last line of the text.
          const last = lines[lines.length - 2];
          expect(headings.has(last), `${template}: "${last}" ends a page`).toBe(false);
          // A paragraph that introduces a list keeps its first item.
          expect(last.endsWith(":"), `${template}: "${last}" ends a page`).toBe(false);
        }
      }
    }
  });

  it("keeps the Client's signature of Part A on the page of the tick boxes", async () => {
    const pages = await pageTexts(await generateContractPdf("nif", valuesFor("nif", MAXIMAL)));
    const partA = pages.find((page) => page.includes("This Contract was concluded (tick one):"));
    expect(partA).toContain("at a distance or away from business premises;");
    expect(partA).toContain("Place and date: Austin, United States, 21 September 2026");
    expect(partA).toContain("— Client");
  });

  it("numbers every page and prints the reference on each", async () => {
    const pages = await pageTexts(await generateContractPdf("bank", valuesFor("bank"), { reference: "Order 7F3A9C1B" }));
    pages.forEach((page, i) => {
      expect(page).toContain(`Page ${i + 1} of ${pages.length}`);
      expect(page).toContain("Reference: Order 7F3A9C1B");
    });

    const bare = await pageTexts(await generateContractPdf("bank", {}));
    bare.forEach((page, i) => {
      expect(page).toContain(`Page ${i + 1} of ${bare.length}`);
      expect(page).not.toContain("Reference:");
    });
  });

  it("takes any reference without breaking the footer", async () => {
    const pdf = await generateContractPdf("nif", {}, { reference: `  Order\n"${"x".repeat(300)}" 王  ` });
    const [first] = await pageTexts(pdf);
    expect(first).toContain('Reference: Order "xxx');
    expect(first).toContain("...");
    expect(first).toContain("Page 1 of");
  });

  it("keeps the em dash, the curly apostrophe and the euro sign", async () => {
    const text = (await pageTexts(await generateContractPdf("nif", valuesFor("nif")))).join(" ");
    expect(text).toContain("(Assignment of a Portuguese Tax Identification Number — NIF)");
    expect(text).toContain("Nature of the Services — Obligation of Means");
    expect(text).toContain("Client’s");
    expect(text).toContain("€149 (one hundred and forty-nine euros)");
    expect(text).toContain("Portal das Finanças");
    expect(text).toContain("PATRÍCIA SOARES VIANA");
  });

  it("prints the model's own brackets when no value is supplied", async () => {
    const text = (await pageTexts(await generateContractPdf("package", {}))).join(" ");
    for (const token of [
      "[FULL NAME]", "[PLACE OF BIRTH]", "[DATE OF BIRTH]", "[PASSPORT NO.]", "[PASSPORT ISSUING AUTHORITY]",
      "[DATE OF ISSUE]", "[EXPIRY DATE]", "[TAX RESIDENCE ADDRESS]", "[EMAIL]", "€[TOTAL FEE] ([FEE IN WORDS] euros)",
      "[REPRESENTATION PERIOD]", "[NUMBER OF BANKS]", "[DAY] [MONTH] [YEAR]", "[PLACE]", "[EMAIL OF THE SECOND PARTY]",
      "[SERVICE: NIF / BANK ACCOUNT / NIF + BANK ACCOUNT PACKAGE]",
    ]) {
      expect(text, token).toContain(token);
    }
  });

  it("draws the two tick boxes as squares, the first one ticked in a contract that has values", async () => {
    const count = (streams: string[], operator: RegExp) =>
      streams.reduce((sum, stream) => sum + (stream.match(operator) ?? []).length, 0);

    const blank = await pageStreams(await generateContractPdf("nif", {}));
    const filled = await pageStreams(await generateContractPdf("nif", valuesFor("nif")));

    // pdf-lib draws a rectangle as a closed path that is stroked: "h" then "S".
    // Two in the whole document, both on the page of Part A.
    const square = /\bh\s+S\b/g;
    expect(count(blank, square)).toBe(2);
    expect(count(filled, square)).toBe(2);
    const partA = filled.filter((stream) => (stream.match(square) ?? []).length > 0);
    expect(partA).toHaveLength(1);
    expect(partA[0].match(square)).toHaveLength(2);

    // The tick is two strokes more than the blank template draws.
    expect(count(filled, /\bl\s/g) - count(blank, /\bl\s/g)).toBe(2);

    // The ballot box character itself is never printed (it is not in WinAnsi and would come out as "?").
    const text = (await pageTexts(await generateContractPdf("nif", valuesFor("nif")))).join(" ");
    expect(text).toContain("(tick one): at a distance or away from business premises; in person, at the premises");
  });

  it("folds what the fonts cannot encode instead of throwing", async () => {
    const applicant = { ...APPLICANT, full_name: "Nguyễn Văn Łukasz", birth_place: "Kraków 🇵🇱, Polska 王" };
    const text = (await pageTexts(await generateContractPdf("nif", valuesFor("nif", applicant)))).join(" ");
    expect(text).toContain("Nguyen Van Lukasz");
    // A value holding a letter the fonts lack is spelled in plain letters throughout (the ó goes too);
    // what has no plain spelling still prints as a question mark rather than throwing. The form refuses
    // such a value now; a row stored before that must still print.
    expect(text).toContain("born in Krakow ??, Polska ?");
  });

  it("never prints a name half accented", async () => {
    const applicant = { ...APPLICANT, full_name: "Łukasz Żółć", birth_place: "Kraków, Polska" };
    const text = (await pageTexts(await generateContractPdf("nif", valuesFor("nif", applicant)))).join(" ");
    expect(text).toContain("Lukasz Zolc");
    expect(text).not.toContain("Zólc");
    // A value the fonts can spell keeps its accent.
    expect(text).toContain("born in Kraków, Polska");
  });

  it("keeps a name typed with combining accents", async () => {
    const applicant = { ...APPLICANT, full_name: "José António" };
    const text = (await pageTexts(await generateContractPdf("nif", valuesFor("nif", applicant)))).join(" ");
    expect(text).toContain("José António");
  });
});
