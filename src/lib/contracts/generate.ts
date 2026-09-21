import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";

import { CONTRACT_MODELS, type ContractBlock } from "@/content/contracts/models.generated";
import type { ContractValues } from "@/content/contracts/variables";
import type { ContractTemplate } from "@/lib/db/types";
import {
  A4,
  INK,
  INK_SOFT,
  Layout,
  foldToWinAnsi,
  measure,
  wrapSpans,
  type Color,
  type Span,
  type WrappedLine,
} from "@/lib/pdf/layout";

/**
 * Renders the contract for legal services as a PDF: the contract of the
 * order's template, then Annex I on a new page.
 *
 * The wording is the firm's, read from its Word models into
 * src/content/contracts/models.generated.ts. Nothing here retypes or edits
 * it: a token that has a value is replaced, a token that has none prints as
 * the model's own bracket, so an unfilled contract reads as a template.
 * The em dash, the curly quotes and the euro sign are kept as written (the
 * standard fonts can encode them); what they cannot encode is folded, never
 * thrown, as in the deeds.
 *
 * Times, 10 pt, justified like the models, with the models' own bold. Two
 * house choices the models leave open, both for a contract that has values:
 * the first tick box of Annex I is drawn ticked (a purchase online is "at a
 * distance"), and an empty [PLACE] becomes a rule to fill by hand.
 *
 * Pure function over `Uint8Array`: no filesystem, no network.
 */

const MARGIN = { top: 64, bottom: 70, left: 66, right: 66 };

const SIZE = { title: 14, subtitle: 11, body: 10, small: 8.5, footer: 8 };

/** Line height per font size. */
function leadingFor(size: number): number {
  return Math.round(size * 1.3 * 10) / 10;
}

const INDENT = {
  /** Where the text of "1. …" hangs. */
  numbered: 20,
  /** Where "a)" sits, and where its text hangs: one step inside the numbered paragraphs. */
  letteredLabel: 20,
  lettered: 40,
  /** A paragraph the model moves in, and the tick boxes. */
  block: 24,
  /** Text beside a tick box. */
  checkbox: 40,
};

/** Room above a signature rule for a handwritten signature. */
const SIGNATURE_ROOM = 30;
const SIGNATURE_RULE_WIDTH = 240;
/** The rule sits this far above the baseline of the name under it. */
const SIGNATURE_RULE_RISE = 11;

const BOX = { size: 8, stroke: 0.8, tick: 1.1 };

const FOOTER_Y = 38;
const REFERENCE_MAX_LENGTH = 80;

/** What an empty [PLACE] prints in a contract that has values: the model's own rule, as in Part C. */
export const BLANK_RULE = "________________________";

const PLACE_TOKEN = "[PLACE]";
const TOKEN = /\[[^\[\]]+\]/g;
const LABEL = /^(\d+\.|[a-z]\))\s+/;

const SUBJECT: Record<ContractTemplate, string> = {
  nif: "Assignment of a Portuguese Tax Identification Number (NIF)",
  bank: "Opening of a Portuguese Bank Account",
  package: "Portuguese Tax Identification Number (NIF) and Opening of a Portuguese Bank Account",
};

// ---------------------------------------------------------------------------
// Values into blocks
// ---------------------------------------------------------------------------

function present(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** True when at least one token has a value: a contract for someone, not the blank template. */
export function hasValues(values: ContractValues): boolean {
  return Object.values(values).some(present);
}

/**
 * Replaces every token that has a value, in one pass (a value is never read
 * again, so a name that happens to contain brackets stays as typed). Tokens
 * without a value are left as the model wrote them. The bold ranges move
 * with the text: a value takes the face of the token it replaces.
 */
export function substituteBlocks(blocks: readonly ContractBlock[], values: ContractValues): ContractBlock[] {
  return blocks.map((block) => {
    const edits: { end: number; delta: number }[] = [];
    let text = "";
    let last = 0;

    for (const match of block.text.matchAll(TOKEN)) {
      const value = values[match[0]];
      if (!present(value)) continue;
      const printed = value.replace(/\s+/g, " ").trim();
      const end = match.index + match[0].length;
      text += block.text.slice(last, match.index) + printed;
      last = end;
      edits.push({ end, delta: printed.length - match[0].length });
    }
    if (edits.length === 0) return block;
    text += block.text.slice(last);

    // The generator guarantees no bold range starts or stops inside a token,
    // so a position is moved by every replacement that ends at or before it.
    const moved = (position: number) =>
      edits.reduce((at, edit) => (edit.end <= position ? at + edit.delta : at), position);
    const bold = block.bold?.map(([start, end]) => [moved(start), moved(end)] as const);

    return bold ? { ...block, text, bold } : { ...block, text };
  });
}

/**
 * The two documents of one contract, values in place. An empty [PLACE] in a
 * contract that has values becomes a rule to fill by hand; the blank
 * template keeps the bracket like every other token.
 */
export function contractBlocks(
  template: ContractTemplate,
  values: ContractValues,
): { contract: ContractBlock[]; annex: ContractBlock[] } {
  const printed =
    hasValues(values) && !present(values[PLACE_TOKEN]) ? { ...values, [PLACE_TOKEN]: BLANK_RULE } : values;
  return {
    contract: substituteBlocks(CONTRACT_MODELS[template], printed),
    annex: substituteBlocks(CONTRACT_MODELS.annex, printed),
  };
}

// ---------------------------------------------------------------------------
// Blocks into set paragraphs
// ---------------------------------------------------------------------------

type Fonts = { regular: PDFFont; bold: PDFFont };

/** A block measured and ready to draw. */
type Prepared = {
  block: ContractBlock;
  lines: WrappedLine[];
  size: number;
  leading: number;
  indent: number;
  align: "left" | "center" | "justify";
  color: Color;
  label?: { text: string; font: PDFFont; x: number };
  /** A tick box drawn beside the first line. */
  box?: "ticked" | "empty";
  /** A signature rule, with room to sign, above the text. */
  signature: boolean;
  /** Space above, skipped at the top of a page the block itself opens. */
  before: number;
  /** Lines plus the signature room, without `before`. */
  height: number;
};

function toSpans(text: string, bold: ContractBlock["bold"], fonts: Fonts): Span[] {
  const spans: Span[] = [];
  let at = 0;
  for (const [start, end] of bold ?? []) {
    if (start > at) spans.push({ text: text.slice(at, start), font: fonts.regular });
    if (end > start) spans.push({ text: text.slice(start, end), font: fonts.bold });
    at = Math.max(at, end);
  }
  if (at < text.length) spans.push({ text: text.slice(at), font: fonts.regular });
  return spans;
}

/** Takes "1." or "a)" off the front, moving the bold ranges with the text. */
function splitLabel(block: ContractBlock): { label: string; text: string; bold: ContractBlock["bold"] } {
  const match = LABEL.exec(block.text);
  if (!match) return { label: "", text: block.text, bold: block.bold };
  const cut = match[0].length;
  return {
    label: match[1],
    text: block.text.slice(cut),
    bold: block.bold
      ?.filter(([, end]) => end > cut)
      .map(([start, end]) => [Math.max(0, start - cut), end - cut] as const),
  };
}

/** Space above a block, from what it is and what came before it. */
function gapBefore(block: ContractBlock, previous: ContractBlock | undefined, next: ContractBlock | undefined): number {
  if (!previous) return 0;
  const heading = previous.kind === "title" || previous.kind === "subtitle";
  switch (block.kind) {
    case "title":
      return 0;
    case "subtitle":
      return previous.kind === "title" ? 5 : 3;
    case "clause":
      return 15;
    case "clauseTitle":
      return 2;
    case "partHeading":
      return 18;
    case "lettered":
      return previous.kind === "lettered" ? 3 : 4;
    case "checkbox":
      return previous.kind === "checkbox" ? 4 : 5;
    case "formLine":
      return 12;
    case "signatureHeading":
      return 16;
    case "signatureLabel":
      // "The First Party," opens a signature; "For and on behalf of" is a caption under one.
      return next?.kind === "signatureName" ? 16 : 2;
    case "signatureName":
      return 0;
    default:
      if (heading) return block.ruleAbove ? 26 : 18;
      if (previous.kind === "clauseTitle") return 8;
      if (previous.kind === "partHeading") return block.small ? 3 : 8;
      if (previous.small) return 9;
      return 6;
  }
}

function prepare(blocks: readonly ContractBlock[], fonts: Fonts, width: number, tickFirstBox: boolean): Prepared[] {
  let boxes = 0;

  return blocks.map((block, index) => {
    const size =
      block.kind === "title" ? SIZE.title : block.small ? SIZE.small : block.kind === "subtitle" ? SIZE.subtitle : SIZE.body;
    const leading = leadingFor(size);
    const prepared: Prepared = {
      block,
      lines: [],
      size,
      leading,
      indent: block.indent ? INDENT.block : 0,
      align: block.center ? "center" : "left",
      color: block.small ? INK_SOFT : INK,
      signature: block.kind === "signatureName",
      before: gapBefore(block, blocks[index - 1], blocks[index + 1]),
      height: 0,
    };

    let text = block.text;
    let bold = block.bold;

    switch (block.kind) {
      case "plain":
        if (!block.center && !block.small && !block.indent) prepared.align = "justify";
        break;
      case "numbered":
      case "lettered": {
        const split = splitLabel(block);
        text = split.text;
        bold = split.bold;
        prepared.align = "justify";
        prepared.indent = block.kind === "numbered" ? INDENT.numbered : INDENT.lettered;
        prepared.label = {
          text: split.label,
          font: fonts.regular,
          x: block.kind === "numbered" ? 0 : INDENT.letteredLabel,
        };
        break;
      }
      case "checkbox":
        prepared.indent = INDENT.checkbox;
        prepared.box = tickFirstBox && boxes === 0 ? "ticked" : "empty";
        boxes += 1;
        break;
      default:
        break;
    }

    prepared.lines = wrapSpans(toSpans(text, bold, fonts), size, width - prepared.indent, foldToWinAnsi);
    prepared.height = prepared.lines.length * leading + (prepared.signature ? SIGNATURE_ROOM : 0);
    return prepared;
  });
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/**
 * What a paragraph needs to start on this page. Its lines may go on to the
 * next one, but never a single one: a paragraph of up to three lines stays
 * whole (two and one is the only way to split it), a longer one needs room
 * for two. drawDocument() looks after the other end of the paragraph.
 */
function start(item: Prepared): number {
  const lines = item.lines.length <= 3 ? item.lines.length : 2;
  return lines * item.leading + (item.signature ? SIGNATURE_ROOM : 0);
}

/**
 * How much must fit under the cursor for block `index` to start here rather
 * than on a fresh page. A heading stays with what it heads (and with what
 * that, in turn, keeps), a paragraph that introduces a list stays with its
 * first item, the closing line ("Done in duplicate") stays with the whole
 * signature block, and a line stays with the signature rule under it.
 */
function keepTogether(items: Prepared[], index: number): number {
  const item = items[index];
  const next = items[index + 1];
  const after = items[index + 2];

  if (next?.block.kind === "signatureHeading" || item.block.kind === "signatureHeading") {
    let total = item.height;
    for (let i = index + 1; i < items.length; i++) total += items[i].before + items[i].height;
    return total;
  }

  if (next?.signature) {
    let total = item.height + next.before + next.height;
    // A caption under the name ("For and on behalf of") belongs to the signature too.
    if (after?.block.kind === "signatureLabel" && items[index + 3]?.block.kind !== "signatureName") {
      total += after.before + after.height;
    }
    return total;
  }
  if (item.signature) return item.height;
  if (!next) return start(item);

  const heads = item.block.kind === "clause" || item.block.kind === "clauseTitle" || item.block.kind === "partHeading";
  const introduces = item.block.text.endsWith(":") && item.lines.length <= 3;
  if (heads || introduces) return item.height + next.before + keepTogether(items, index + 1);

  return start(item);
}

function drawBox(layout: Layout, item: Prepared) {
  const { page, y } = layout.cursor;
  const x = MARGIN.left + INDENT.block;
  const bottom = y - 1;
  page.drawRectangle({
    x,
    y: bottom,
    width: BOX.size,
    height: BOX.size,
    borderWidth: BOX.stroke,
    borderColor: INK,
  });
  if (item.box !== "ticked") return;
  // Two strokes: the short one down to the foot of the tick, the long one up and out.
  const foot = { x: x + 3.3, y: bottom + 1.7 };
  page.drawLine({ start: { x: x + 1.5, y: bottom + 4 }, end: foot, thickness: BOX.tick, color: INK });
  page.drawLine({ start: foot, end: { x: x + 7, y: bottom + 7.2 }, thickness: BOX.tick, color: INK });
}

function drawSeparator(layout: Layout, gap: number) {
  const { page, y } = layout.cursor;
  // Halfway through the gap already taken, above the line about to be set.
  const at = y + SIZE.body + gap / 2 - 4;
  page.drawLine({
    start: { x: MARGIN.left, y: at },
    end: { x: A4.width - MARGIN.right, y: at },
    thickness: 0.5,
    color: INK_SOFT,
  });
}

/** How many of the block's lines fit above the bottom margin, from where the cursor stands. */
function linesThatFit(layout: Layout, item: Prepared): number {
  const room = layout.cursor.y - (item.signature ? SIGNATURE_ROOM : 0) - MARGIN.bottom;
  return Math.floor(room / item.leading);
}

function drawDocument(layout: Layout, items: Prepared[]) {
  items.forEach((item, index) => {
    let opensPage = index === 0 || item.block.breakBefore === true;
    if (item.block.breakBefore) layout.newPage();
    if (!opensPage) layout.gap(item.before);

    const before = layout.cursor.page;
    layout.reserve(keepTogether(items, index));

    // No paragraph sends a single last line to the next page. When exactly
    // one would go over, a second one goes with it; a paragraph too short to
    // leave two lines behind goes over whole. Settled before any mark is
    // drawn, so a tick box or a rule never stays behind on the old page.
    let fit = linesThatFit(layout, item);
    if (item.lines.length - fit === 1 && fit < 3) {
      layout.newPage();
      fit = linesThatFit(layout, item);
    }
    if (layout.cursor.page !== before) opensPage = true;

    if (item.block.ruleAbove && !opensPage) drawSeparator(layout, item.before);

    if (item.signature) {
      layout.gap(SIGNATURE_ROOM);
      const { page, y } = layout.cursor;
      page.drawLine({
        start: { x: MARGIN.left, y: y + SIGNATURE_RULE_RISE },
        end: { x: MARGIN.left + SIGNATURE_RULE_WIDTH, y: y + SIGNATURE_RULE_RISE },
        thickness: 0.75,
        color: INK_SOFT,
      });
    }
    if (item.box) drawBox(layout, item);

    const options = {
      indent: item.indent,
      align: item.align,
      color: item.color,
      leading: item.leading,
      label: item.label,
    };

    if (item.lines.length - fit === 1) {
      layout.lines(item.lines.slice(0, fit - 1), item.size, options);
      layout.newPage();
      layout.lines(item.lines.slice(fit - 1), item.size, { ...options, label: undefined });
    } else {
      layout.lines(item.lines, item.size, options);
    }
  });
}

/** One line for the footer, whatever the caller passed. */
function footerReference(reference: string | undefined): string {
  const text = foldToWinAnsi((reference ?? "").replace(/\s+/g, " ")).trim();
  if (!text) return "";
  return text.length > REFERENCE_MAX_LENGTH ? `${text.slice(0, REFERENCE_MAX_LENGTH - 3)}...` : text;
}

function drawFooters(doc: PDFDocument, font: PDFFont, reference: string) {
  const pages = doc.getPages();
  pages.forEach((page, index) => {
    const label = `Page ${index + 1} of ${pages.length}`;
    page.drawText(label, {
      x: A4.width - MARGIN.right - measure(label, font, SIZE.footer),
      y: FOOTER_Y,
      size: SIZE.footer,
      font,
      color: INK_SOFT,
    });
    if (reference) {
      page.drawText(`Reference: ${reference}`, {
        x: MARGIN.left,
        y: FOOTER_Y,
        size: SIZE.footer,
        font,
        color: INK_SOFT,
      });
    }
  });
}

/**
 * Builds the contract of `template` followed by Annex I on a new page.
 * Called with no values it produces the blank template, every field showing
 * the model's own bracket. `reference` is printed in the footer of every
 * page beside the page number: the order it belongs to.
 */
export async function generateContractPdf(
  template: ContractTemplate,
  values: ContractValues,
  opts: { reference?: string } = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Contract for Legal Services", { showInWindowTitleBar: true });
  doc.setSubject(SUBJECT[template]);
  doc.setAuthor("ALTTAVIA RELOCATION, Unipessoal Lda.");
  doc.setLanguage("en-GB");
  doc.setProducer("Alttavia Relocation");
  doc.setCreator("Alttavia Relocation");

  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.TimesRoman),
    bold: await doc.embedFont(StandardFonts.TimesRomanBold),
  };

  const layout = new Layout(doc, {
    margin: MARGIN,
    leading: leadingFor(SIZE.body),
    itemIndent: INDENT.numbered,
    fold: foldToWinAnsi,
  });

  const { contract, annex } = contractBlocks(template, values);
  const tick = hasValues(values);

  drawDocument(layout, prepare(contract, fonts, layout.contentWidth, tick));
  layout.newPage();
  drawDocument(layout, prepare(annex, fonts, layout.contentWidth, tick));

  drawFooters(doc, fonts.regular, footerReference(opts.reference));
  return doc.save();
}
