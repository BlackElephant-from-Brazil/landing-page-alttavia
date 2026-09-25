import { inflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { LETTERHEAD_LOGO } from "@/content/contracts/letterhead.generated";
import { CONTRACT_LETTERHEAD, CONTRACT_MODELS } from "@/content/contracts/models.generated";
import { buildContractValues, buildContractValuesFromFields, type ContractValues } from "@/content/contracts/variables";
import type { ContractTemplate, UserServiceApplicantRow } from "@/lib/db/types";
import {
  BLANK_RULE,
  FIRM_SIGNATURE_MAX_PIXELS,
  SECOND_PARTY_SIGNATORY,
  SPECIMEN_LINE,
  annexBlocks,
  contractBlocks,
  generateContractPdf,
  hasValues,
  substituteBlocks,
} from "./generate";

const TEMPLATES: ContractTemplate[] = ["nif", "bank", "package", "couple"];
const TOKEN = /\[[^\[\]]+\]/;
const NEW_ADDRESS = "Av. António Augusto Aguiar, 24, 1st floor right, Office 3, 1050-016 Lisbon, Portugal";

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

/** Every image drawn on each page: where (x, y of the lower left corner) and how big, in points. */
async function pageImages(pdf: Uint8Array): Promise<{ x: number; y: number; width: number; height: number }[][]> {
  const image =
    /1 0 0 1 ([\d.-]+) ([\d.-]+) cm\s+1 0 0 1 0 0 cm\s+([\d.-]+) 0 0 ([\d.-]+) 0 0 cm\s+1 0 0 1 0 0 cm\s+\/\S+ Do/g;
  return (await pageStreams(pdf)).map((stream) =>
    [...stream.matchAll(image)].map(([, x, y, width, height]) => ({
      x: Number(x),
      y: Number(y),
      width: Number(width),
      height: Number(height),
    })),
  );
}

/** The baseline of the first line on a page that reads `text`, from the text matrices pdf-lib wrote. */
async function baselineOf(pdf: Uint8Array, pageIndex: number, text: string): Promise<number | undefined> {
  const stream = (await pageStreams(pdf))[pageIndex];
  for (const [, , y, hex] of stream.matchAll(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm\s*<([0-9A-Fa-f]*)> Tj/g)) {
    if (winAnsi.decode(Buffer.from(hex, "hex")).startsWith(text)) return Number(y);
  }
  return undefined;
}

/** A small transparent PNG with a stroke across it, 600 x 200: a stand in for the firm's signature. */
async function samplePng(width = 600, height = 200): Promise<Uint8Array> {
  const { deflateSync } = await import("node:zlib");
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.abs(y - height / 2 - Math.sin(x / 40) * 40) > 3) continue;
      const at = y * (width * 4 + 1) + 1 + x * 4;
      raw[at] = 20;
      raw[at + 1] = 40;
      raw[at + 2] = 110;
      raw[at + 3] = 255;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, "latin1");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])));
    return Buffer.concat([head, data, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
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

const FEE: Record<ContractTemplate, number> = { nif: 14900, bank: 39900, package: 49700, couple: 59700 };

/** Her partner, applicant 1 of the Couple package. */
const PARTNER: UserServiceApplicantRow = {
  ...APPLICANT,
  id: "00000000-0000-4000-8000-000000000003",
  applicant_index: 1,
  full_name: "John Robert Doe",
  gender: "m",
  birth_place: "Denver, Colorado, United States of America",
  birth_date: "1982-11-23",
  passport_number: "Y7654321",
};

/**
 * The values of a paid order, as ensure.ts builds them. For the Couple
 * package the partner is the given applicant's twin when the applicant is
 * not the usual one, so a worst case is a worst case for both persons.
 */
function valuesFor(template: ContractTemplate, applicant: UserServiceApplicantRow = APPLICANT, place: string | null = "Austin, United States") {
  const partner: UserServiceApplicantRow =
    applicant === APPLICANT ? PARTNER : { ...applicant, id: PARTNER.id, applicant_index: 1 };
  return buildContractValues({
    order: { total_cents: FEE[template], paid_at: "2026-09-21T10:15:00Z" },
    service: { slug: template, name: template, contract_template: template },
    applicants: [applicant, partner],
    email: "jane.doe@example.com",
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
    expect(text).toContain("is €149 (one hundred and forty-nine euros), VAT included.");
    expect(text).toContain(`with registered office at ${NEW_ADDRESS}, duly represented by`);
    expect(text).toContain(`To: ALTTAVIA RELOCATION, Unipessoal Lda., ${NEW_ADDRESS} — info@alttavia-relocation.com`);
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
    // The partner row of a one person order prints nowhere.
    expect([...pack.contract, ...pack.annex].map((b) => b.text).join("\n")).not.toContain("John Robert Doe");
  });

  it("names both persons of the Couple package, in the contract and in Annex I", () => {
    const { contract, annex } = contractBlocks("couple", valuesFor("couple"));
    const text = contract.map((b) => b.text).join("\n");
    expect(text).toContain(
      "United States of America, and John Robert Doe, born in Denver, Colorado, United States of America, on 23 November 1982",
    );
    expect(text).toContain("both with email address jane.doe@example.com, hereinafter jointly referred to as the First Party or Client;");
    expect(text).toContain("is €597 (five hundred and ninety-seven euros), VAT included.");

    const signatures = contract.slice(contract.findIndex((b) => b.kind === "signatureHeading")).map((b) => b.text);
    expect(signatures).toEqual([
      "SIGNATURES",
      "The First Party,",
      "Jane Alice Doe",
      "John Robert Doe",
      "The Second Party,",
      SECOND_PARTY_SIGNATORY,
      "For and on behalf of ALTTAVIA RELOCATION, Unipessoal Lda.",
    ]);

    const opening = annex[3];
    expect(opening.text).toBe(
      "This Annex forms an integral part of the Contract for Legal Services signed between Jane Alice Doe, holder of " +
        "passport no. X1234567, and John Robert Doe, holder of passport no. Y7654321, jointly as Client, and ALTTAVIA " +
        "RELOCATION, Unipessoal Lda., as Second Party, relating to COUPLE PACKAGE, dated 21 September 2026 (the \"Contract\").",
    );
    expect(opening.bold?.map(([s, e]) => opening.text.slice(s, e))).toEqual([
      "Jane Alice Doe",
      "X1234567",
      "John Robert Doe",
      "Y7654321",
      "ALTTAVIA RELOCATION, Unipessoal Lda.",
      "COUPLE PACKAGE",
      "21 September 2026",
    ]);
    expect(annex.filter((b) => b.kind === "signatureName").map((b) => b.text)).toEqual([
      "Jane Alice Doe — Client",
      "John Robert Doe — Client",
      "Signature of the consumer (only if this form is notified on paper)",
    ]);
  });

  it("adapts Annex I for the Couple package only, and in two places", () => {
    for (const template of ["nif", "bank", "package"] as const) expect(annexBlocks(template)).toBe(CONTRACT_MODELS.annex);
    const couple = annexBlocks("couple");
    expect(couple).toHaveLength(CONTRACT_MODELS.annex.length + 1);
    const changed = couple.filter((block) => !CONTRACT_MODELS.annex.some((original) => JSON.stringify(original) === JSON.stringify(block)));
    expect(changed.map((b) => b.text)).toEqual([
      "This Annex forms an integral part of the Contract for Legal Services signed between [FULL NAME], holder of passport " +
        "no. [PASSPORT NO.], and [FULL NAME 2], holder of passport no. [PASSPORT NO. 2], jointly as Client, and ALTTAVIA " +
        "RELOCATION, Unipessoal Lda., as Second Party, relating to [SERVICE: NIF / BANK ACCOUNT / NIF + BANK ACCOUNT " +
        "PACKAGE], dated [DAY] [MONTH] [YEAR] (the \"Contract\").",
      "[FULL NAME 2] — Client",
    ]);
  });

  it("reads as a template when nothing is supplied", () => {
    for (const template of TEMPLATES) {
      const { contract, annex } = contractBlocks(template, {});
      expect(contract).toEqual(CONTRACT_MODELS[template]);
      expect(annex).toEqual(annexBlocks(template));
    }
    const text = contractBlocks("nif", {}).annex.map((b) => b.text).join("\n");
    expect(text).toContain("Place and date: [PLACE], [DAY] [MONTH] [YEAR]");
    expect(hasValues({})).toBe(false);
    expect(hasValues({ "[FULL NAME]": "  " })).toBe(false);
  });

  it("keeps the bracket of a token that has no value, beside the ones that have", () => {
    const values = buildContractValuesFromFields({ template: "nif", applicant: null, email: null, totalCents: 14900, paidAt: null });
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

// Several cases here generate and read back a dozen or more PDFs across the four models: more than vitest's
// default 5 seconds on a busy machine, so the whole block gets 60.
describe("contract PDF", { timeout: 60_000 }, () => {
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
    // The letterhead of 2026-09-25 moved no model past its pin; the Couple package may take one page more than the package.
    const limit: Record<ContractTemplate, number> = { nif: 11, bank: 11, package: 12, couple: 13 };
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

    // Both Client lines of the Couple package stay there too.
    for (const values of [valuesFor("couple"), valuesFor("couple", MAXIMAL)]) {
      const couple = await pageTexts(await generateContractPdf("couple", values));
      const page = couple.find((text) => text.includes("This Contract was concluded (tick one):"));
      expect(page?.match(/— Client/g)).toHaveLength(2);
    }
  });

  it("keeps both First Party lines of the Couple package with the rest of the signatures", async () => {
    const pages = await pageTexts(await generateContractPdf("couple", valuesFor("couple")));
    const closing = pages.find((page) => page.includes("Done in duplicate at Lisbon"));
    expect(closing).toContain("The First Party, Jane Alice Doe John Robert Doe The Second Party, PATRÍCIA SOARES VIANA");
  });

  it("prints the letterhead at the top of the first page, and only there", async () => {
    for (const template of TEMPLATES) {
      const pdf = await generateContractPdf(template, valuesFor(template), { reference: "Order 1" });
      const lines = await pageLines(pdf);
      // The header's four lines, then the title.
      expect(lines[0].slice(0, 5), template).toEqual([...CONTRACT_LETTERHEAD[template], "CONTRACT FOR LEGAL SERVICES"]);
      for (const page of lines.slice(1)) expect(page.join(" "), template).not.toContain("+351 934 548 395");

      // The logo: once, on the first page, 30 mm wide, its aspect kept, inside the left margin.
      const images = await pageImages(pdf);
      expect(images[0], template).toHaveLength(1);
      const [logo] = images[0];
      expect(logo.x).toBeCloseTo(66, 1);
      expect(logo.width).toBeCloseTo((30 * 72) / 25.4, 1);
      expect(logo.height / logo.width).toBeCloseTo(LETTERHEAD_LOGO.height / LETTERHEAD_LOGO.width, 3);
      expect(logo.y + logo.height).toBeLessThan(842 - 30);
      for (const page of images.slice(1)) expect(page, template).toEqual([]);

      // The contract starts under the letterhead.
      const title = await baselineOf(pdf, 0, "CONTRACT FOR LEGAL SERVICES");
      expect(title).toBeLessThan(logo.y - 10);
    }
  });

  it("draws the firm's signature above the Second Party's line when it is given, and nothing when not", async () => {
    const signature = await samplePng();
    for (const template of TEMPLATES) {
      const signed = await generateContractPdf(template, valuesFor(template), { signature });
      const pages = await pageTexts(signed);
      const at = pages.findIndex((page) => page.includes(SECOND_PARTY_SIGNATORY) && page.includes("The Second Party,"));
      const images = await pageImages(signed);
      expect(images.flat(), template).toHaveLength(2);
      expect(images[at], template).toHaveLength(1);
      const [drawn] = images[at];

      // About 40 mm wide, aspect kept (600 x 200), set on the rule: above the name, below the label.
      expect(drawn.width).toBeCloseTo((40 * 72) / 25.4, 1);
      expect(drawn.width / drawn.height).toBeCloseTo(3, 3);
      const name = (await baselineOf(signed, at, SECOND_PARTY_SIGNATORY)) ?? 0;
      const label = (await baselineOf(signed, at, "The Second Party,")) ?? 0;
      expect(drawn.y).toBeGreaterThan(name);
      expect(drawn.y + drawn.height).toBeLessThan(label - 2);

      // Without it, the logo alone; null and an empty file count as none.
      for (const none of [undefined, null, new Uint8Array(0)]) {
        const blank = await generateContractPdf(template, valuesFor(template), { signature: none });
        expect((await pageImages(blank)).flat(), template).toHaveLength(1);
      }
    }
  });

  it("keeps the signed agreement within its page pin and its signature block on one page", async () => {
    const signature = await samplePng(300, 300);
    const limit: Record<ContractTemplate, number> = { nif: 11, bank: 11, package: 12, couple: 13 };
    for (const template of TEMPLATES) {
      const pdf = await generateContractPdf(template, valuesFor(template, MAXIMAL), { signature });
      const pages = await pageTexts(pdf);
      expect(pages.length, template).toBeLessThanOrEqual(limit[template] + 1);
      const closing = pages.filter((page) => page.includes("Done in duplicate at Lisbon"));
      expect(closing[0], template).toContain("For and on behalf of ALTTAVIA RELOCATION, Unipessoal Lda.");
    }
  });

  it("refuses a signature file it cannot read, so the caller can go on without it", async () => {
    await expect(generateContractPdf("nif", valuesFor("nif"), { signature: new Uint8Array([1, 2, 3, 4]) })).rejects.toThrow();
  });

  it("embeds a signature up to 600 x 300 pixels and refuses a larger one, which anyone holding the PDF could extract", async () => {
    expect(FIRM_SIGNATURE_MAX_PIXELS).toEqual({ width: 600, height: 300 });
    const fits = await generateContractPdf("nif", valuesFor("nif"), { signature: await samplePng(600, 300) });
    expect((await pageImages(fits)).flat()).toHaveLength(2);

    for (const [width, height] of [
      [601, 200],
      [400, 301],
    ]) {
      await expect(
        generateContractPdf("nif", valuesFor("nif"), { signature: await samplePng(width, height) }),
      ).rejects.toThrow(`is ${width} x ${height} pixels; at most 600 x 300`);
    }
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

  it("marks every page of a specimen under the footer, and never moves the text for it", async () => {
    const plain = await generateContractPdf("package", valuesFor("package"), { reference: "Order 7F3A9C1B" });
    const specimen = await generateContractPdf("package", valuesFor("package"), { reference: "Order 7F3A9C1B", specimen: true });

    const pages = await pageLines(specimen);
    expect(pages).toHaveLength(await pageCount(plain));
    pages.forEach((lines, i) => {
      // Under the footer: the last line of the page.
      expect(lines[lines.length - 1]).toBe(SPECIMEN_LINE);
      expect(lines[lines.length - 2]).toContain(`Page ${i + 1} of ${pages.length}`);
    });
    // Everything above it is the plain agreement, line for line.
    expect(pages.map((lines) => lines.slice(0, -1))).toEqual(await pageLines(plain));

    for (const page of await pageTexts(plain)) expect(page).not.toContain(SPECIMEN_LINE);
    expect(SPECIMEN_LINE).not.toMatch(/[–—]|\b(problem|trap|free|refund|money back)\b/i);
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
