import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import {
  buildPowerOfAttorney,
  type PoaBlock,
  type PrincipalDetails,
  type SigningDate,
} from "@/content/power-of-attorney";

/**
 * Renders the power of attorney as a PDF.
 *
 * Times is deliberate: this is a deed someone prints, signs by hand and hands
 * to Finanças, and it should look like one. The English half is set in italic
 * so a Portuguese reader can see at a glance which paragraphs are the
 * operative ones without the two languages blurring together.
 *
 * Pure function over `Uint8Array`: no filesystem, no network, so it runs the
 * same in a script, in a Netlify function, or in a test.
 */

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = { top: 56, bottom: 52, left: 62, right: 62 };
const CONTENT_WIDTH = A4.width - MARGIN.left - MARGIN.right;

/**
 * Tuned so the blank deed lands on a single A4 sheet. A power of attorney that
 * spills a lone signature onto a second page reads as a mistake to whoever
 * receives it, and a test pins the page count so a future copy edit cannot
 * quietly reintroduce that.
 */
const SIZE = { title: 16, body: 9.6, signature: 10 };
const LEADING = { body: 12.6, paragraphGap: 8, itemGap: 6 };

/** Hanging indent for the numbered clauses, wide enough for "1)". */
const ITEM_INDENT = 20;

const INK = rgb(0.05, 0.09, 0.15);
const INK_SOFT = rgb(0.28, 0.33, 0.4);

/**
 * The standard PDF fonts encode WinAnsi, which covers Portuguese accents but
 * not every character a word processor may have introduced. Anything outside
 * it is folded to the closest plain equivalent rather than allowed to throw
 * halfway through a legal document.
 */
const SUBSTITUTIONS: Record<string, string> = {
  "‘": "'", "’": "'", "‚": "'", "′": "'",
  "“": '"', "”": '"', "„": '"', "″": '"',
  "–": "-", "—": "-", "−": "-",
  "…": "...", " ": " ", " ": " ", " ": " ",
  "•": "-", "­": "",
};

function sanitize(text: string): string {
  return text.replace(/[ ­ –—‘’‚“”„•… ′″−]/g, (c) => SUBSTITUTIONS[c] ?? "");
}

type Fonts = { regular: PDFFont; italic: PDFFont; bold: PDFFont };

/** Splits `text` into lines that fit `width` at `size`. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = sanitize(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    // A single word longer than the column is broken rather than allowed to
    // run off the page. Rare here, but a long address can do it.
    if (font.widthOfTextAtSize(word, size) > width) {
      let chunk = "";
      for (const char of word) {
        if (font.widthOfTextAtSize(chunk + char, size) > width) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk += char;
        }
      }
      line = chunk;
    } else {
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Cursor over a growing document, adding pages as the content needs them. */
class Layout {
  private page: PDFPage;
  private y: number;

  constructor(private doc: PDFDocument) {
    this.page = doc.addPage([A4.width, A4.height]);
    this.y = A4.height - MARGIN.top;
  }

  private ensure(height: number) {
    if (this.y - height >= MARGIN.bottom) return;
    this.page = this.doc.addPage([A4.width, A4.height]);
    this.y = A4.height - MARGIN.top;
  }

  gap(height: number) {
    this.y -= height;
  }

  text(
    content: string,
    font: PDFFont,
    size: number,
    options: { indent?: number; color?: ReturnType<typeof rgb>; align?: "left" | "center" } = {},
  ) {
    const indent = options.indent ?? 0;
    const width = CONTENT_WIDTH - indent;
    for (const line of wrap(content, font, size, width)) {
      this.ensure(LEADING.body);
      const lineWidth = font.widthOfTextAtSize(line, size);
      const x =
        options.align === "center"
          ? MARGIN.left + (CONTENT_WIDTH - lineWidth) / 2
          : MARGIN.left + indent;
      this.page.drawText(line, { x, y: this.y, size, font, color: options.color ?? INK });
      this.y -= LEADING.body;
    }
  }

  /** A numbered clause: the number sits in the margin, the text hangs indented. */
  item(number: string, content: string, font: PDFFont, size: number, color = INK) {
    const lines = wrap(content, font, size, CONTENT_WIDTH - ITEM_INDENT);
    lines.forEach((line, i) => {
      this.ensure(LEADING.body);
      if (i === 0) {
        this.page.drawText(number, { x: MARGIN.left, y: this.y, size, font, color });
      }
      this.page.drawText(line, { x: MARGIN.left + ITEM_INDENT, y: this.y, size, font, color });
      this.y -= LEADING.body;
    });
  }

  rule(width: number) {
    this.ensure(24);
    this.page.drawLine({
      start: { x: MARGIN.left, y: this.y },
      end: { x: MARGIN.left + width, y: this.y },
      thickness: 0.75,
      color: INK_SOFT,
    });
    this.y -= LEADING.body;
  }
}

function render(layout: Layout, blocks: PoaBlock[], fonts: Fonts) {
  for (const block of blocks) {
    switch (block.kind) {
      case "title":
        layout.text(block.pt, fonts.bold, SIZE.title, { align: "center" });
        layout.text(block.en, fonts.italic, SIZE.title, { align: "center", color: INK_SOFT });
        layout.gap(LEADING.paragraphGap * 2);
        break;

      case "paragraph":
        layout.text(block.pt, fonts.regular, SIZE.body);
        layout.gap(LEADING.itemGap);
        layout.text(block.en, fonts.italic, SIZE.body, { color: INK_SOFT });
        layout.gap(LEADING.paragraphGap);
        break;

      case "item":
        layout.item(block.number, block.pt, fonts.regular, SIZE.body);
        layout.gap(LEADING.itemGap);
        layout.item(block.number, block.en, fonts.italic, SIZE.body, INK_SOFT);
        layout.gap(LEADING.paragraphGap);
        break;

      case "signature":
        // Room for a handwritten signature above the printed name.
        layout.gap(LEADING.paragraphGap * 4);
        layout.rule(250);
        layout.text(block.name, fonts.regular, SIZE.signature);
        break;
    }
  }
}

/**
 * Builds the deed. Called with no arguments it produces the blank template,
 * every field showing the model's own bracketed placeholder.
 */
export async function generatePowerOfAttorney(
  principal: PrincipalDetails = {},
  signedOn: SigningDate = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Procuração / Power of Attorney");
  doc.setSubject("Atribuição de Número de Identificação Fiscal (NIF)");
  doc.setProducer("Alttavia Relocation");
  doc.setCreator("Alttavia Relocation");

  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.TimesRoman),
    italic: await doc.embedFont(StandardFonts.TimesRomanItalic),
    bold: await doc.embedFont(StandardFonts.TimesRomanBold),
  };

  render(new Layout(doc), buildPowerOfAttorney(principal, signedOn), fonts);
  return doc.save();
}
