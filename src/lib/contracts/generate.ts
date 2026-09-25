import { PDFDocument, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

import { LETTERHEAD_LOGO } from "@/content/contracts/letterhead.generated";
import { CONTRACT_LETTERHEAD, CONTRACT_MODELS, type ContractBlock } from "@/content/contracts/models.generated";
import { partnerToken, type ContractValues } from "@/content/contracts/variables";
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
 * The first page carries the models' letterhead (Patrícia's answer of
 * 2026-09-24): the logo at the top left, 30 mm wide, the header's lines at
 * the top right in 8 pt, a thin rule under both. The icon column and the
 * footer drawing of the Word letterhead are not reproduced.
 *
 * The firm's signature: when `options.signature` holds a PNG (Patrícia's
 * digitised signature, read by ensure.ts from the bucket), it is drawn above
 * the Second Party's signature line, about 40 mm wide, with the room above
 * the line grown to fit it. Without one the line stays blank for a pen. A
 * file pdf-lib cannot read throws, and so does one larger than
 * FIRM_SIGNATURE_MAX_PIXELS; the caller decides to generate again without it.
 * The cap is there because every paying client, and every inbox the PDF is
 * forwarded to, can pull the embedded image out of the file at the size it
 * was embedded (review of 2026-09-25): 600 pixels across the 40 mm it is
 * printed at is about 380 dpi, enough for print and no more.
 * scripts/firm-signature.mjs shrinks a larger scan before it uploads it.
 *
 * A specimen (2026-09-25): `options.specimen` prints SPECIMEN_LINE under the
 * footer of every page. ensure.ts asks for it on every agreement of an order
 * that was not paid with real money (src/lib/orders/live-payment.ts), the
 * same orders that never get the firm's signature, so a PDF made on staging
 * or with a test card cannot pass for a real agreement.
 *
 * The Couple package names two persons. Its model (derived from the package
 * model by scripts/edit-contract-models.mjs) already has both in the parties
 * paragraph and two First Party signature lines. Annex I is shared by every
 * model and names one Client, so for the Couple package it is adapted here,
 * in two places only: the opening paragraph names the partner too ("and
 * [FULL NAME 2], holder of passport no. [PASSPORT NO. 2], jointly as
 * Client"), and Part A gets a second Client signature line. Our drafting,
 * read by the firm.
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
/** Space between two signature lines in a row: the Couple package's two First Party lines, Part A's two Client lines. */
const SIGNATURE_BETWEEN = 10;

/** Points per millimetre. */
const MM = 72 / 25.4;

/**
 * The firm's signature image: at most 40 mm wide and 45 pt tall, aspect
 * kept, set 6 pt in from the start of the rule and dipping 3 pt below it,
 * as ink does.
 */
const FIRM_SIGNATURE = { maxWidth: 40 * MM, maxHeight: 45, inset: 6, dip: 3 };

/**
 * The largest signature image embedded, in pixels: about 380 dpi at the
 * printed 40 mm, 45 pt being some 16 mm tall. scripts/firm-signature.mjs
 * holds the same numbers and shrinks a larger file to fit before uploading.
 */
export const FIRM_SIGNATURE_MAX_PIXELS = { width: 600, height: 300 } as const;

/** The name printed under the Second Party's rule, as the models have it: the line the firm's signature goes above. */
export const SECOND_PARTY_SIGNATORY = "PATRÍCIA SOARES VIANA";

/**
 * The letterhead of the first page. The logo's top edge sits `top` below the
 * page edge, 30 mm wide; the header's lines are set right aligned against
 * the right margin, centred on the logo; a rule `ruleGap` under the logo,
 * then the contract's first line `textGap` under the rule.
 */
const LETTERHEAD = { top: 34, logoWidth: 30 * MM, size: 8, leading: 10.4, ruleGap: 8, textGap: 26 };

const BOX = { size: 8, stroke: 0.8, tick: 1.1 };

const FOOTER_Y = 38;
/** The specimen line sits under the footer, inside the bottom margin, so the text never moves. */
const SPECIMEN_Y = 26;

/** Printed under the footer of every page of an agreement that was not paid for with real money. */
export const SPECIMEN_LINE = "Specimen from the test environment. Not a binding agreement.";
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
  // As the Couple model's own subtitle reads (singular NIF), until the firm settles its wording for two NIFs.
  couple: "Couple Package, Portuguese Tax Identification Number (NIF) and Opening of a Portuguese Bank Account",
};

// ---------------------------------------------------------------------------
// Annex I for the Couple package
// ---------------------------------------------------------------------------

/** Where Annex I's opening paragraph names the Client, and what the Couple package puts before "as Client". */
const ANNEX_CLIENT = "as Client";
const ANNEX_PARTNER = `and ${partnerToken("[FULL NAME]")}, holder of passport no. ${partnerToken("[PASSPORT NO.]")}, jointly `;
/** Part A's signature line under the Client's rule. */
const ANNEX_CLIENT_SIGNATURE = "[FULL NAME] — Client";

/**
 * Inserts `insertion` into a block at `at`. Bold ranges after the insertion
 * point move with the text; the insertion's own tokens listed in `bold` are
 * set in bold, as the model sets the tokens it replaces.
 */
function insertIntoBlock(block: ContractBlock, at: number, insertion: string, bold: readonly string[]): ContractBlock {
  const moved = (block.bold ?? []).map(([start, end]) =>
    start >= at ? ([start + insertion.length, end + insertion.length] as const) : ([start, end] as const),
  );
  const added = bold.map((token) => {
    const start = at + insertion.indexOf(token);
    return [start, start + token.length] as const;
  });
  const ranges = [...moved, ...added].sort((a, b) => a[0] - b[0]);
  return { ...block, text: block.text.slice(0, at) + insertion + block.text.slice(at), bold: ranges };
}

/**
 * Annex I as the template prints it. Every model but the Couple package
 * takes it as the firm wrote it. The Couple package's names both persons in
 * its opening paragraph and gives Part A a second Client signature line.
 */
export function annexBlocks(template: ContractTemplate): readonly ContractBlock[] {
  const annex = CONTRACT_MODELS.annex;
  if (template !== "couple") return annex;

  const out: ContractBlock[] = [];
  let opening = false;
  let signature = false;
  for (const block of annex) {
    const at = block.text.indexOf(ANNEX_CLIENT);
    if (!opening && block.kind === "plain" && block.text.includes("[FULL NAME]") && at > 0) {
      out.push(insertIntoBlock(block, at, ANNEX_PARTNER, [partnerToken("[FULL NAME]"), partnerToken("[PASSPORT NO.]")]));
      opening = true;
      continue;
    }
    out.push(block);
    if (!signature && block.kind === "signatureName" && block.text === ANNEX_CLIENT_SIGNATURE) {
      out.push({ ...block, text: ANNEX_CLIENT_SIGNATURE.replace("[FULL NAME]", partnerToken("[FULL NAME]")) });
      signature = true;
    }
  }
  // Annex I changed under us: better no agreement than one naming half the Client.
  if (!opening || !signature) throw new Error("contracts: Annex I no longer has the lines the Couple package adapts.");
  return out;
}

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
    annex: substituteBlocks(annexBlocks(template), printed),
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
  /** Room above the rule: SIGNATURE_ROOM, more when the firm's signature image is drawn there. */
  signatureRoom: number;
  /** The firm's signature image, drawn above this block's rule. */
  image?: { image: PDFImage; width: number; height: number };
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
      // A second signature line straight under another gets clear of the name above it.
      return previous.kind === "signatureName" ? SIGNATURE_BETWEEN : 0;
    default:
      if (heading) return block.ruleAbove ? 26 : 18;
      if (previous.kind === "clauseTitle") return 8;
      if (previous.kind === "partHeading") return block.small ? 3 : 8;
      if (previous.small) return 9;
      return 6;
  }
}

/**
 * The firm's signature, embedded: a PNG pdf-lib can read, no larger than
 * FIRM_SIGNATURE_MAX_PIXELS. Anything else throws, before anything is drawn.
 */
async function embedSignature(doc: PDFDocument, bytes: Uint8Array): Promise<PDFImage> {
  const image = await doc.embedPng(bytes);
  const max = FIRM_SIGNATURE_MAX_PIXELS;
  if (image.width > max.width || image.height > max.height) {
    throw new Error(
      `contracts: the firm's signature is ${image.width} x ${image.height} pixels; at most ${max.width} x ${max.height} is embedded. ` +
        "Upload it again with npm run firm:signature, which shrinks it.",
    );
  }
  return image;
}

/** The firm's signature at its printed size: at most FIRM_SIGNATURE.maxWidth wide and maxHeight tall, aspect kept. */
function signatureSize(image: PDFImage): { width: number; height: number } {
  const aspect = image.width / image.height;
  const width = Math.min(FIRM_SIGNATURE.maxWidth, FIRM_SIGNATURE.maxHeight * aspect);
  return { width, height: width / aspect };
}

function prepare(
  blocks: readonly ContractBlock[],
  fonts: Fonts,
  width: number,
  tickFirstBox: boolean,
  signature: PDFImage | null = null,
): Prepared[] {
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
      signatureRoom: SIGNATURE_ROOM,
      before: gapBefore(block, blocks[index - 1], blocks[index + 1]),
      height: 0,
    };

    if (signature && block.kind === "signatureName" && block.text === SECOND_PARTY_SIGNATORY) {
      const drawn = signatureSize(signature);
      prepared.image = { image: signature, ...drawn };
      // The image's top must stay clear of the label above the rule.
      prepared.signatureRoom = Math.max(SIGNATURE_ROOM, Math.ceil(drawn.height - FIRM_SIGNATURE.dip + 2));
    }

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
    prepared.height = prepared.lines.length * leading + (prepared.signature ? prepared.signatureRoom : 0);
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
  return lines * item.leading + (item.signature ? item.signatureRoom : 0);
}

/**
 * How much must fit under the cursor for block `index` to start here rather
 * than on a fresh page. A heading stays with what it heads (and with what
 * that, in turn, keeps), a paragraph that introduces a list stays with its
 * first item, the closing line ("Done in duplicate") stays with the whole
 * signature block, and a line stays with the signature rules under it (two
 * in a row for the Couple package), as does a signature line with the one
 * under it.
 */
function keepTogether(items: Prepared[], index: number): number {
  const item = items[index];
  const next = items[index + 1];

  if (next?.block.kind === "signatureHeading" || item.block.kind === "signatureHeading") {
    let total = item.height;
    for (let i = index + 1; i < items.length; i++) total += items[i].before + items[i].height;
    return total;
  }

  if (next?.signature) {
    let total = item.height;
    let i = index + 1;
    for (; items[i]?.signature; i++) total += items[i].before + items[i].height;
    // A caption under the name ("For and on behalf of") belongs to the signature too.
    const after = items[i];
    if (after?.block.kind === "signatureLabel" && items[i + 1]?.block.kind !== "signatureName") {
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
  const room = layout.cursor.y - (item.signature ? item.signatureRoom : 0) - MARGIN.bottom;
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
      layout.gap(item.signatureRoom);
      const { page, y } = layout.cursor;
      const rule = y + SIGNATURE_RULE_RISE;
      page.drawLine({
        start: { x: MARGIN.left, y: rule },
        end: { x: MARGIN.left + SIGNATURE_RULE_WIDTH, y: rule },
        thickness: 0.75,
        color: INK_SOFT,
      });
      if (item.image) {
        page.drawImage(item.image.image, {
          x: MARGIN.left + FIRM_SIGNATURE.inset,
          y: rule - FIRM_SIGNATURE.dip,
          width: item.image.width,
          height: item.image.height,
        });
      }
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

function drawFooters(doc: PDFDocument, font: PDFFont, reference: string, specimen: boolean) {
  const pages = doc.getPages();
  pages.forEach((page, index) => {
    if (specimen) {
      page.drawText(SPECIMEN_LINE, {
        x: MARGIN.left,
        y: SPECIMEN_Y,
        size: SIZE.footer,
        font,
        color: INK_SOFT,
      });
    }
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
 * The letterhead at the top of the first page: the logo at the top left,
 * the header's lines right aligned at the top right, centred on the logo,
 * and a thin rule under both across the text column. Answers where the rule
 * sits, so the contract can start under it.
 */
function drawLetterhead(page: PDFPage, logo: PDFImage, lines: readonly string[], font: PDFFont): number {
  const logoWidth = LETTERHEAD.logoWidth;
  const logoHeight = logoWidth * (logo.height / logo.width);
  const top = A4.height - LETTERHEAD.top;
  page.drawImage(logo, { x: MARGIN.left, y: top - logoHeight, width: logoWidth, height: logoHeight });

  // Cap height of Times is about 0.66 of the size: the block of lines is centred on the logo by its ink.
  const block = (lines.length - 1) * LETTERHEAD.leading + LETTERHEAD.size * 0.66;
  let y = top - (logoHeight - block) / 2 - LETTERHEAD.size * 0.66;
  for (const line of lines) {
    const text = foldToWinAnsi(line);
    page.drawText(text, {
      x: A4.width - MARGIN.right - measure(text, font, LETTERHEAD.size),
      y,
      size: LETTERHEAD.size,
      font,
      color: INK_SOFT,
    });
    y -= LETTERHEAD.leading;
  }

  const rule = top - logoHeight - LETTERHEAD.ruleGap;
  page.drawLine({
    start: { x: MARGIN.left, y: rule },
    end: { x: A4.width - MARGIN.right, y: rule },
    thickness: 0.5,
    color: INK_SOFT,
  });
  return rule;
}

export type GenerateContractOptions = {
  /** Printed in the footer of every page beside the page number: the order the contract belongs to. */
  reference?: string;
  /** The firm's signature, a PNG, drawn above the Second Party's line. Null or absent leaves the line blank. */
  signature?: Uint8Array | null;
  /** Prints SPECIMEN_LINE under the footer of every page: an agreement nobody paid for with real money. */
  specimen?: boolean;
};

/**
 * Builds the contract of `template` followed by Annex I on a new page, the
 * letterhead on the first page. Called with no values it produces the blank
 * template, every field showing the model's own bracket. `reference` is
 * printed in the footer of every page beside the page number; `signature`
 * is the firm's, drawn above the Second Party's signature line; `specimen`
 * marks every page as a test agreement.
 */
export async function generateContractPdf(
  template: ContractTemplate,
  values: ContractValues,
  opts: GenerateContractOptions = {},
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
  // Embedded before anything is drawn: a signature pdf-lib cannot read, or one too large, throws here, with nothing half done.
  const signature = opts.signature && opts.signature.byteLength > 0 ? await embedSignature(doc, opts.signature) : null;

  // The letterhead takes the top of the first page; the contract starts under its rule.
  const logo = await doc.embedPng(LETTERHEAD_LOGO.png);
  const rule = drawLetterhead(layout.cursor.page, logo, CONTRACT_LETTERHEAD[template], fonts.regular);
  layout.gap(layout.cursor.y - (rule - LETTERHEAD.textGap));

  drawDocument(layout, prepare(contract, fonts, layout.contentWidth, tick, signature));
  layout.newPage();
  drawDocument(layout, prepare(annex, fonts, layout.contentWidth, tick));

  drawFooters(doc, fonts.regular, footerReference(opts.reference), opts.specimen === true);
  return doc.save();
}
