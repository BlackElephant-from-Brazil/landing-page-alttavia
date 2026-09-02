import { inflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { ATTORNEY, buildPowerOfAttorney } from "@/content/power-of-attorney";
import { generatePowerOfAttorney } from "./generate";

/**
 * Reads back the text pdf-lib wrote. Strings are stored as hex in the content
 * stream, one per drawn line, so decoding them proves the accents survived
 * WinAnsi encoding rather than merely that a file was produced.
 */
async function textOf(pdf: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(pdf);
  const lines: string[] = [];

  for (const page of doc.getPages()) {
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
  }
  return lines.join(" ");
}

describe("power of attorney PDF", () => {
  it("is a valid single page A4 document", async () => {
    const pdf = await generatePowerOfAttorney();
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");

    const doc = await PDFDocument.load(pdf);
    // One sheet: a deed that spills a lone signature onto page two looks broken.
    expect(doc.getPageCount()).toBe(1);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
    expect(Math.round(doc.getPage(0).getHeight())).toBe(842);
  });

  it("keeps Portuguese accents intact through the font encoding", async () => {
    const text = await textOf(await generatePowerOfAttorney());
    expect(text).toContain("Procuração");
    expect(text).toContain("Identificação Fiscal");
    expect(text).toContain("FINANÇAS");
  });

  it("carries both languages", async () => {
    const text = await textOf(await generatePowerOfAttorney());
    expect(text).toContain("Power of Attorney");
    expect(text).toContain("Tax and Customs Authority");
    expect(text).toContain("shall lapse with the full execution");
  });

  it("states the attorney's own credentials, which are never variable", async () => {
    const text = await textOf(await generatePowerOfAttorney());
    expect(text).toContain(ATTORNEY.barCard);
    expect(text).toContain(ATTORNEY.taxNumber);
    expect(text).toContain("Patrícia Soares Viana");
  });

  it("prints the model's own placeholders when no data is supplied", async () => {
    const text = await textOf(await generatePowerOfAttorney());
    expect(text).toContain("[NOME COMPLETO DO(A) MANDANTE]");
    expect(text).toContain("[FULL NAME OF THE PRINCIPAL]");
    expect(text).toContain("[número do passaporte]");
    expect(text).toContain("[dia]");
  });

  it("substitutes supplied details on both language sides", async () => {
    const pdf = await generatePowerOfAttorney(
      {
        fullName: "Jane Alice Doe",
        nationality: "American",
        passportNumber: "X1234567",
      },
      { day: "12", monthPt: "março", monthEn: "March", year: "2026" },
    );
    const text = await textOf(pdf);

    expect(text).toContain("Jane Alice Doe");
    expect(text).toContain("X1234567");
    expect(text).toContain("março");
    expect(text).toContain("March");
    // Filled fields must stop showing their placeholder.
    expect(text).not.toContain("[NOME COMPLETO DO(A) MANDANTE]");
    expect(text).not.toContain("[passport number]");
    // Untouched ones still do.
    expect(text).toContain("[data de nascimento]");
  });
});

describe("power of attorney content", () => {
  it("pairs every Portuguese block with an English one", () => {
    for (const block of buildPowerOfAttorney()) {
      if (block.kind === "signature") continue;
      expect(block.pt.length, `PT missing on ${block.kind}`).toBeGreaterThan(0);
      expect(block.en.length, `EN missing on ${block.kind}`).toBeGreaterThan(0);
      expect(block.pt).not.toBe(block.en);
    }
  });

  it("grants exactly the two powers the firm's model grants", () => {
    const items = buildPowerOfAttorney().filter((b) => b.kind === "item");
    expect(items.map((i) => i.number)).toEqual(["1)", "2)"]);
  });

  it("declares the attorney is not a manager of assets, which the tax office requires", () => {
    const items = buildPowerOfAttorney().filter((b) => b.kind === "item");
    expect(items[0].pt).toContain("não atuará como gestora de bens ou direitos");
    expect(items[0].en).toContain("not act as a manager of assets or rights");
  });
});
