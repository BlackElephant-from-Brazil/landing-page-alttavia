import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import {
  buildPowerOfAttorney,
  type PoaBlock,
  type PrincipalDetails,
  type SigningDate,
} from "@/content/power-of-attorney";
import type { PoaTemplate } from "@/lib/db/types";

/**
 * Renders a power of attorney as a PDF.
 *
 * Times is deliberate: this is a deed someone prints, signs by hand and hands
 * to Finanças or a bank, and it should look like one. The English half is set
 * in italic so a Portuguese reader can see at a glance which paragraphs are
 * the operative ones without the two languages blurring together.
 *
 * Pure function over `Uint8Array`: no filesystem, no network, so it runs the
 * same in a script, in a route handler, or in a test.
 */

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = { top: 56, bottom: 52, left: 62, right: 62 };
const CONTENT_WIDTH = A4.width - MARGIN.left - MARGIN.right;

/**
 * Tuned so the NIF deed lands on a single A4 sheet, filled or blank, and the
 * bank deed on two. A power of attorney that spills a lone signature onto an
 * extra page reads as a mistake to whoever receives it, and tests pin both
 * page counts so a future copy edit cannot quietly reintroduce that.
 */
const SIZE = { title: 16, body: 9.6, signature: 10 };
const LEADING = { body: 12.6, paragraphGap: 8, itemGap: 6 };

/** Hanging indent for the numbered and lettered clauses, wide enough for "1)" and "a)". */
const ITEM_INDENT = 20;

/**
 * Space kept together for the end of a deed: the closing paragraph pair
 * ("Fazendo fé" and its English), the gap for a handwritten signature, the
 * rule and the printed name. Whatever the fields hold, the signature never
 * sits alone on a page: if less than this remains, the closing block starts
 * on a fresh one.
 */
const CLOSING_RESERVE = 150;

const INK = rgb(0.05, 0.09, 0.15);
const INK_SOFT = rgb(0.28, 0.33, 0.4);

/** The PDF subject line per deed, for the reader's document properties. */
const SUBJECT: Record<PoaTemplate, string> = {
  poa_nif: "Atribuição de Número de Identificação Fiscal (NIF)",
  poa_bank: "Abertura de conta bancária em Portugal",
};

/**
 * The standard PDF fonts encode WinAnsi, which covers Portuguese accents but
 * not every character a word processor or a passport may have introduced.
 * Typographic quotes and dashes are folded to their plain forms first; any
 * other character outside WinAnsi is folded to its closest plain form (a
 * decomposed base letter, or a table entry for letters that do not
 * decompose), and what cannot be folded at all prints as "?" rather than
 * throwing halfway through a legal document. A "?" in a name is visible to
 * the client on download, so it gets corrected; a silently dropped letter
 * would not be.
 */
const SUBSTITUTIONS: Record<string, string> = {
  "‘": "'", "’": "'", "‚": "'", "′": "'",
  "“": '"', "”": '"', "„": '"', "″": '"',
  "–": "-", "—": "-", "−": "-",
  "…": "...", "\u00A0": " ", "\u202F": " ", "\u2009": " ",
  "•": "-", "\u00AD": "",
};

/** Letters outside Latin-1 that NFD cannot decompose, mapped to their usual plain form. */
const PLAIN_LETTERS: Record<string, string> = {
  "Ł": "L", "ł": "l", "Đ": "D", "đ": "d", "Ħ": "H", "ħ": "h", "ı": "i", "Ŧ": "T", "ŧ": "t",
  "Ŀ": "L", "ŀ": "l", "Ø": "O", "ø": "o", "Œ": "OE", "œ": "oe", "Æ": "AE", "æ": "ae",
};

/** Printable ASCII, Latin-1 and the WinAnsi extras the standard fonts know. */
const WIN_ANSI = /^[\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]$/;

function foldCharacter(char: string): string {
  if (WIN_ANSI.test(char)) return char;
  const plain = PLAIN_LETTERS[char];
  if (plain !== undefined) return plain;
  const decomposed = char.normalize("NFD").replace(/[\u0300-\u036F]/g, "");
  if (decomposed !== char && decomposed.length > 0 && WIN_ANSI.test(decomposed)) return decomposed;
  return "?";
}

function sanitize(text: string): string {
  const folded = text.replace(/[\u00A0\u00AD\u2009\u202F–—‘’‚“”„•…′″−]/g, (c) => SUBSTITUTIONS[c] ?? "");
  let out = "";
  for (const char of folded) out += foldCharacter(char);
  return out;
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

  /** Starts a new page unless at least `height` remains above the bottom margin. */
  reserve(height: number) {
    this.ensure(height);
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

  /** A numbered or lettered clause: the label sits in the margin, the text hangs indented. */
  item(label: string, content: string, font: PDFFont, size: number, color = INK) {
    const lines = wrap(content, font, size, CONTENT_WIDTH - ITEM_INDENT);
    lines.forEach((line, i) => {
      this.ensure(LEADING.body);
      if (i === 0) {
        this.page.drawText(sanitize(label), { x: MARGIN.left, y: this.y, size, font, color });
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
  // The last paragraph before the signature is the closing line; it and the
  // signature are kept on the same page.
  const closing = blocks.findIndex((block, i) => block.kind === "paragraph" && blocks[i + 1]?.kind === "signature");

  blocks.forEach((block, i) => {
    if (i === closing) layout.reserve(CLOSING_RESERVE);
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
  });
}

/**
 * Builds one deed. Called with only the kind it produces the blank template,
 * every field showing the model's own bracketed placeholder.
 */
export async function generatePowerOfAttorney(
  kind: PoaTemplate,
  principal: PrincipalDetails = {},
  signedOn: SigningDate = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Procuração / Power of Attorney");
  doc.setSubject(SUBJECT[kind]);
  doc.setProducer("Alttavia Relocation");
  doc.setCreator("Alttavia Relocation");

  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.TimesRoman),
    italic: await doc.embedFont(StandardFonts.TimesRomanItalic),
    bold: await doc.embedFont(StandardFonts.TimesRomanBold),
  };

  render(new Layout(doc), buildPowerOfAttorney(kind, principal, signedOn), fonts);
  return doc.save();
}
