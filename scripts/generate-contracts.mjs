#!/usr/bin/env node
/**
 * Writes src/content/contracts/models.generated.ts from the firm's Word
 * models in docs/terms/, so the contract PDF says what the models say, and
 * src/content/contracts/letterhead.generated.ts with the logo of their
 * letterhead. The wording is never retyped: change a .docx, run this,
 * commit all three.
 *
 *   npm run contracts:generate               write both modules
 *   npm run contracts:generate -- --check    exit 1 when either module is stale
 *   npm run contracts:generate -- --stdout   print the models module, write nothing
 *
 * The models in docs/terms/ are themselves written by
 * scripts/edit-contract-models.mjs from the originals the firm sent on
 * 2026-09-21 (docs/terms/originais-2026-09-21/), with the changes Patrícia
 * approved on 2026-09-24; the Couple package model is derived there from
 * the package model. Run that script first when an edit changes.
 *
 * A .docx is a zip. Its entries are found through the central directory and
 * inflated with node's own zlib (scripts/lib/zip.mjs), so there is no
 * dependency to install. The body, word/document.xml, is walked tag by tag:
 * a paragraph's text is its runs joined (Word splits a run wherever it
 * likes, often inside a word), entities are decoded, tabs and line breaks
 * become a space, and the bold runs are kept as character ranges because the
 * models use bold to make the waivers conspicuous.
 *
 * What the script cannot read in the BODY (a table, automatic numbering, a
 * symbol run, a drawing) stops it with an error instead of quietly dropping
 * text from a legal document.
 *
 * The LETTERHEAD lives outside the body. Each model has a page header and a
 * page footer: the body's section properties (w:headerReference,
 * w:footerReference, type "default") name a relationship id,
 * word/_rels/document.xml.rels turns it into a part (word/header2.xml,
 * word/footer1.xml). The header holds the firm's logo, a column of small
 * icons and a text box with a phone number, an email address, a URL and an
 * office address; the footer holds one drawing. The script exports the
 * header's text, line by line, as CONTRACT_LETTERHEAD, and the logo (the
 * widest picture of the header) as LETTERHEAD_LOGO in its own module: the
 * PNG shrunk to a size that prints sharp at 30 mm (scripts/lib/png.mjs) and
 * written as base64. The five models must carry the same logo. The icon
 * column and the footer drawing are not reproduced; a run says so once, on
 * stderr. A footer that gains text, or a model with a different first page
 * or even page header, stops the script: that would be wording nobody
 * exported.
 *
 * docs/agreement-contract.md section 3 is the design.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

import { decodePng, downscale, encodePng, isPng } from "./lib/png.mjs";
import { readZipEntry } from "./lib/zip.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TERMS = join(ROOT, "docs", "terms");
const OUT = join(ROOT, "src", "content", "contracts", "models.generated.ts");
const LETTERHEAD_OUT = join(ROOT, "src", "content", "contracts", "letterhead.generated.ts");

/** Model id, then the file in docs/terms/. The order is the order of the module. */
const MODELS = [
  ["nif", "MODELO - Contract for Legal Services - NIF (blank fields).docx"],
  ["bank", "MODELO - Contract for Legal Services - Bank Account (blank fields).docx"],
  ["package", "MODELO - Contract for Legal Services - NIF + Bank Account Package (blank fields).docx"],
  ["couple", "MODELO - Contract for Legal Services - Couple Package (blank fields).docx"],
  ["annex", "MODELO - Annex I - Immediate Commencement and Withdrawal (blank fields).docx"],
];

/**
 * The logo is shrunk by a whole factor to at least this many pixels across
 * (2639 / 6 = 440): some 370 dpi at the 30 mm the contract prints it, sharp
 * on paper, and cheap to embed, which every agreement does (a larger logo
 * made each PDF measurably slower to generate).
 */
const LOGO_TARGET_WIDTH = 400;

// ---------------------------------------------------------------------------
// WordprocessingML
// ---------------------------------------------------------------------------

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return String.fromCodePoint(code);
    }
    const known = ENTITIES[body];
    if (known === undefined) throw new Error(`Unknown XML entity ${whole}.`);
    return known;
  });
}

function attribute(attributes, name) {
  const match = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attributes);
  return match ? decodeEntities(match[1]) : undefined;
}

/** An on/off property such as <w:b/>: present means on unless it says otherwise. */
function isOn(attributes) {
  const value = attribute(attributes, "w:val");
  return value === undefined || !["0", "false", "off"].includes(value);
}

/** Elements whose content this script would lose or mangle. Better to stop. */
const UNREADABLE = new Map([
  ["w:tbl", "a table"],
  ["w:numPr", "automatic numbering (the number is not in the text)"],
  ["w:sym", "a symbol run"],
  ["w:drawing", "a drawing"],
  ["w:pict", "a picture"],
  ["w:object", "an embedded object"],
  ["mc:AlternateContent", "alternate content (the text would be read twice)"],
  ["w:footnoteReference", "a footnote"],
  ["w:endnoteReference", "an endnote"],
  ["w:fldSimple", "a field"],
  ["w:instrText", "a field"],
]);

/** One tag (closing slash, name, attributes, self closing slash) or one stretch of text between tags. */
const TAGS = /<(\/?)([A-Za-z0-9_:.-]+)((?:\s[^<>]*?)?)(\/?)>|([^<]+)/g;

/**
 * Reads the body into paragraphs:
 * `{ chars: [{ c, bold }], jc, indented, border, breakBefore, breakAfter, sizes }`.
 */
function readParagraphs(xml, file) {
  const paragraphs = [];
  let paragraph = null;
  let inParagraphProperties = false;
  let inRun = false;
  let inRunProperties = false;
  let inText = false;
  let run = { bold: false, size: undefined };

  const push = (text) => {
    for (const c of text) paragraph.chars.push({ c, bold: run.bold });
    if (run.size !== undefined && text.trim() !== "") paragraph.sizes.push(run.size);
  };

  for (const match of xml.matchAll(TAGS)) {
    const [, closing, tag, attributes = "", selfClosing, text] = match;

    if (text !== undefined) {
      if (inText && paragraph) push(decodeEntities(text));
      continue;
    }
    if (!closing && UNREADABLE.has(tag)) {
      throw new Error(`${file}: the model holds ${UNREADABLE.get(tag)} (<${tag}>). Teach scripts/generate-contracts.mjs to read it first.`);
    }

    switch (tag) {
      case "w:p":
        if (closing) {
          if (paragraph) paragraphs.push(paragraph);
          paragraph = null;
        } else {
          paragraph = { chars: [], jc: undefined, indented: false, border: false, breakBefore: false, breakAfter: false, sizes: [] };
          if (selfClosing) {
            paragraphs.push(paragraph);
            paragraph = null;
          }
        }
        break;

      case "w:pPr":
        inParagraphProperties = !closing && !selfClosing;
        break;

      case "w:r":
        inRun = !closing && !selfClosing;
        if (inRun) run = { bold: false, size: undefined };
        break;

      case "w:rPr":
        // A paragraph's own <w:rPr> formats the paragraph mark, not the text.
        inRunProperties = !closing && !selfClosing && inRun && !inParagraphProperties;
        break;

      case "w:b":
        if (inRunProperties) run.bold = isOn(attributes);
        break;

      case "w:sz":
        if (inRunProperties) run.size = Number(attribute(attributes, "w:val"));
        break;

      case "w:jc":
        if (inParagraphProperties && paragraph) paragraph.jc = attribute(attributes, "w:val");
        break;

      case "w:ind":
        if (inParagraphProperties && paragraph) {
          const left = Number(attribute(attributes, "w:left") ?? attribute(attributes, "w:start") ?? 0);
          const hanging = Number(attribute(attributes, "w:hanging") ?? 0);
          // A hanging indent is how the lettered items are set; only a plain
          // left indent moves the whole paragraph in.
          paragraph.indented = left > 0 && hanging === 0;
        }
        break;

      case "w:pBdr":
        if (inParagraphProperties && paragraph && !closing) paragraph.border = true;
        break;

      case "w:pageBreakBefore":
        if (inParagraphProperties && paragraph && isOn(attributes)) paragraph.breakBefore = true;
        break;

      case "w:pStyle":
      case "w:rStyle":
        console.warn(`${file}: style ${attribute(attributes, "w:val")} is not read; only direct formatting is.`);
        break;

      case "w:t":
        inText = !closing && !selfClosing;
        break;

      case "w:tab":
        if (inRun && paragraph && !inRunProperties) push(" ");
        break;

      case "w:br":
      case "w:cr":
        if (!inRun || !paragraph) break;
        if (attribute(attributes, "w:type") === "page") {
          if (paragraph.chars.some(({ c }) => c.trim() !== "")) paragraph.breakAfter = true;
          else paragraph.breakBefore = true;
        } else {
          push(" ");
        }
        break;

      case "w:noBreakHyphen":
        if (inRun && paragraph) push("-");
        break;

      default:
        break;
    }
  }
  return paragraphs;
}

// ---------------------------------------------------------------------------
// Letterhead: the page header and footer, which live outside the body
// ---------------------------------------------------------------------------

const DOCUMENT = "word/document.xml";
const SETTINGS = "word/settings.xml";

/** Where the relationships of a part live: word/header2.xml has word/_rels/header2.xml.rels. */
function relationshipsOf(part) {
  return posix.join(posix.dirname(part), "_rels", `${posix.basename(part)}.rels`);
}

/**
 * Relationship id to part name, from the relationships of `part`: for the
 * body "rId8" to "word/header2.xml", for a header "rId2" to
 * "word/media/image3.png". A target is relative to the part's folder.
 */
function readRelationships(buffer, part, file) {
  const xml = readZipEntry(buffer, relationshipsOf(part), file).toString("utf8");
  const parts = new Map();
  for (const match of xml.matchAll(TAGS)) {
    const [, closing, tag, attributes = ""] = match;
    if (closing || tag !== "Relationship") continue;
    const id = attribute(attributes, "Id");
    const target = attribute(attributes, "Target");
    if (!id || !target || attribute(attributes, "TargetMode") === "External") continue;
    parts.set(id, target.startsWith("/") ? target.slice(1) : posix.join(posix.dirname(part), target));
  }
  return parts;
}

/**
 * The parts the body names as its default header and footer, or null. Read
 * from the last section properties of the body, which govern the document.
 * A model whose first page or even pages carry a different header would
 * print wording this script does not export, so that stops the run.
 */
function letterheadParts(documentXml, buffer, file) {
  const sections = documentXml.match(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/g) ?? [];
  if (sections.length > 1) {
    throw new Error(`${file}: the model has ${sections.length} sections; the letterhead is read from one. Teach scripts/generate-contracts.mjs first.`);
  }
  const found = { header: null, footer: null };
  if (sections.length === 0) return found;

  const relationships = readRelationships(buffer, DOCUMENT, file);
  const settings = readZipEntry(buffer, SETTINGS, file).toString("utf8");
  const evenAndOdd = [...settings.matchAll(TAGS)].some(
    ([, closing, tag, attributes = ""]) => !closing && tag === "w:evenAndOddHeaders" && isOn(attributes),
  );
  let titlePage = false;
  const references = [];

  for (const match of sections[0].matchAll(TAGS)) {
    const [, closing, tag, attributes = ""] = match;
    if (closing) continue;
    if (tag === "w:titlePg" && isOn(attributes)) titlePage = true;
    if (tag === "w:headerReference" || tag === "w:footerReference") {
      references.push({
        kind: tag === "w:headerReference" ? "header" : "footer",
        type: attribute(attributes, "w:type") ?? "default",
        id: attribute(attributes, "r:id"),
      });
    }
  }

  for (const { kind, type, id } of references) {
    const inUse = type === "default" || (type === "first" && titlePage) || (type === "even" && evenAndOdd);
    if (!inUse) continue; // Word keeps unused first and even page parts around; they never print.
    if (type !== "default") {
      throw new Error(`${file}: the model prints a different ${kind} on its ${type} page(s). Teach scripts/generate-contracts.mjs first.`);
    }
    const part = relationships.get(id);
    if (!part) throw new Error(`${file}: ${kind} reference ${id} is not in ${relationshipsOf(DOCUMENT)}.`);
    found[kind] = part;
  }
  return found;
}

/**
 * The text of a header or footer part, one line per paragraph that has any,
 * top to bottom, and how many pictures the part holds. Word stores a text
 * box twice, as a drawing (mc:Choice) and as a VML fallback with the same
 * paragraphs, so the fallback is dropped before reading. A text box is a
 * paragraph inside a paragraph: lines are ordered by where each one opens.
 */
function readLetterheadPart(xml) {
  const once = xml.replace(/<mc:Fallback\b[\s\S]*?<\/mc:Fallback>/g, "");
  const open = [];
  const closed = [];
  let opened = 0;
  let inText = false;
  let images = 0;

  for (const match of once.matchAll(TAGS)) {
    const [, closing, tag, , selfClosing, text] = match;
    const current = open[open.length - 1];

    if (text !== undefined) {
      if (inText && current) current.text += decodeEntities(text);
      continue;
    }
    switch (tag) {
      case "w:p":
        if (closing) {
          const paragraph = open.pop();
          if (paragraph) closed.push(paragraph);
        } else if (!selfClosing) {
          open.push({ index: opened++, text: "" });
        }
        break;
      case "w:t":
        inText = !closing && !selfClosing;
        break;
      case "w:tab":
      case "w:br":
      case "w:cr":
        if (current) current.text += " ";
        break;
      case "w:noBreakHyphen":
        if (current) current.text += "-";
        break;
      case "a:blip":
      case "v:imagedata":
        if (!closing) images += 1;
        break;
      default:
        break;
    }
  }

  const lines = closed
    .sort((a, b) => a.index - b.index)
    .map((paragraph) => paragraph.text.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "");
  return { lines, images };
}

/**
 * The pictures a header or footer part draws: `{ media, width, height }`,
 * the media part ("word/media/image3.png") and the size the model draws it
 * at, in EMU (914400 to the inch). A text box is a drawing too, but with no
 * picture in it, and is skipped.
 */
function readPictures(buffer, part, file) {
  const xml = readZipEntry(buffer, part, file)
    .toString("utf8")
    .replace(/<mc:Fallback\b[\s\S]*?<\/mc:Fallback>/g, "");
  const relationships = readRelationships(buffer, part, file);
  const pictures = [];
  for (const [drawing] of xml.matchAll(/<wp:(anchor|inline)\b[\s\S]*?<\/wp:\1>/g)) {
    const blip = /<a:blip\b[^>]*?\sr:embed="([^"]+)"/.exec(drawing);
    if (!blip) continue;
    const media = relationships.get(blip[1]);
    if (!media) throw new Error(`${file}: picture ${blip[1]} of ${part} is not in ${relationshipsOf(part)}.`);
    const extent = /<wp:extent\b([^>]*?)\/?>/.exec(drawing)?.[1] ?? "";
    pictures.push({ media, width: Number(attribute(extent, "cx") ?? 0), height: Number(attribute(extent, "cy") ?? 0) });
  }
  return pictures;
}

/**
 * One model's letterhead: `{ lines, images, logo }`. The header's text; how
 * many pictures header and footer hold together; and the logo, the widest
 * picture of the header, as the PNG file the model embeds.
 */
function readLetterhead(documentXml, buffer, file) {
  const parts = letterheadParts(documentXml, buffer, file);
  const header = parts.header ? readLetterheadPart(readZipEntry(buffer, parts.header, file).toString("utf8")) : { lines: [], images: 0 };
  const footer = parts.footer ? readLetterheadPart(readZipEntry(buffer, parts.footer, file).toString("utf8")) : { lines: [], images: 0 };
  if (footer.lines.length > 0) {
    throw new Error(`${file}: the page footer holds text ("${footer.lines[0]}"). Teach scripts/generate-contracts.mjs to export it first.`);
  }

  let logo = null;
  if (parts.header) {
    const [widest] = readPictures(buffer, parts.header, file).sort((a, b) => b.width - a.width);
    if (widest) {
      const bytes = readZipEntry(buffer, widest.media, file);
      if (!isPng(bytes)) throw new Error(`${file}: the letterhead logo ${widest.media} is not a PNG. Teach scripts/generate-contracts.mjs first.`);
      logo = { media: widest.media, bytes, width: widest.width, height: widest.height };
    }
  }
  return { lines: header.lines, images: header.images + footer.images, logo };
}

// ---------------------------------------------------------------------------
// Paragraphs to blocks
// ---------------------------------------------------------------------------

/** The empty ballot box the Annex uses, and its ticked cousins, in case a model arrives pre-ticked. */
const BALLOT_BOX = /^[☐☑☒]$/;
const WHITESPACE = /^[\s ]$/;

/** Collapses whitespace runs to one space, trims, and returns text plus bold ranges. */
function normalise(chars) {
  const kept = [];
  for (const char of chars) {
    if (WHITESPACE.test(char.c)) {
      if (kept.length > 0 && kept[kept.length - 1].c !== " ") kept.push({ c: " ", bold: char.bold });
    } else {
      kept.push(char);
    }
  }
  while (kept.length > 0 && kept[kept.length - 1].c === " ") kept.pop();

  // A space is as bold as its neighbours: bold only between two bold letters.
  // Ranges therefore start and end on ink, and two bold runs split by a
  // space Word left regular read as one.
  const ranges = [];
  let text = "";
  let start = -1;
  let lastBoldEnd = -1;
  let index = 0;
  for (const char of kept) {
    const length = char.c.length;
    if (char.c === " ") {
      // Decided by what follows.
    } else if (char.bold) {
      if (start < 0) start = index;
      lastBoldEnd = index + length;
    } else if (start >= 0) {
      ranges.push([start, lastBoldEnd]);
      start = -1;
    }
    text += char.c;
    index += length;
  }
  if (start >= 0) ranges.push([start, lastBoldEnd]);
  return { text, bold: ranges };
}

function mostCommon(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best;
  for (const [value, count] of counts) if (best === undefined || count > counts.get(best)) best = value;
  return best;
}

const TOKEN = /\[[^\[\]]+\]/g;

function toBlocks(paragraphs, file) {
  const baseSize = mostCommon(paragraphs.flatMap((p) => p.sizes));
  const blocks = [];
  let afterRule = false;
  let separatorPending = false;
  let inSignatures = false;
  let breakPending = false;

  for (const paragraph of paragraphs) {
    let chars = paragraph.chars;
    const firstInk = chars.findIndex(({ c }) => !WHITESPACE.test(c));
    const isCheckbox = firstInk >= 0 && BALLOT_BOX.test(chars[firstInk].c);
    if (isCheckbox) chars = chars.slice(firstInk + 1);

    const { text, bold } = normalise(chars);
    if (paragraph.breakBefore) breakPending = true;

    if (text === "") {
      // An empty paragraph is a page break, a rule (a bottom border) or plain
      // spacing. None carries wording. The models draw the line a signature
      // sits on as a bordered run of spaces, and what follows it is the name
      // under the signature; a bordered paragraph with no run text at all is
      // only a separator, kept as a flag on the paragraph after it.
      if (paragraph.border && paragraph.chars.length > 0) afterRule = true;
      else if (paragraph.border) separatorPending = true;
      if (paragraph.breakAfter) breakPending = true;
      continue;
    }

    const center = paragraph.jc === "center";
    const allBold = bold.length === 1 && bold[0][0] === 0 && bold[0][1] === text.length;
    const previous = blocks[blocks.length - 1];
    const inHeading = blocks.every((b) => b.kind === "title" || b.kind === "subtitle");

    let kind;
    if (afterRule) kind = "signatureName";
    else if (isCheckbox) kind = "checkbox";
    else if (center && allBold && /^[A-Z]+(?:-[A-Z]+)* CLAUSE$/.test(text)) kind = "clause";
    else if (center && previous?.kind === "clause") kind = "clauseTitle";
    else if (center && allBold && /^SIGNATURES?$/.test(text)) kind = "signatureHeading";
    else if (center && blocks.length === 0) kind = "title";
    else if (center && inHeading) kind = "subtitle";
    else if (allBold && /^PART [A-Z]\b/.test(text)) kind = "partHeading";
    else if (/^\d+\.\s/.test(text)) kind = "numbered";
    else if (/^[a-z]\)\s/.test(text)) kind = "lettered";
    else if (/_{3,}/.test(text) || (paragraph.jc === "left" && !inSignatures && /^[A-Z][^:]{0,40}:\s/.test(text))) kind = "formLine";
    else if (inSignatures) kind = "signatureLabel";
    else kind = "plain";

    if (kind === "signatureHeading") inSignatures = true;
    afterRule = false;

    for (const token of text.matchAll(TOKEN)) {
      const from = token.index;
      const to = from + token[0].length;
      for (const [start, end] of bold) {
        const inside = start <= from && to <= end;
        const outside = end <= from || to <= start;
        if (!inside && !outside) {
          throw new Error(`${file}: bold starts or stops inside ${token[0]}; a value could not be set in one face.`);
        }
      }
    }

    const block = { kind, text };
    if (bold.length > 0) block.bold = bold;
    if (center) block.center = true;
    const size = paragraph.sizes.length > 0 ? Math.max(...paragraph.sizes) : baseSize;
    if (size < baseSize) block.small = true;
    if (paragraph.indented || isCheckbox) block.indent = true;
    if (breakPending) block.breakBefore = true;
    breakPending = paragraph.breakAfter;
    if (separatorPending) block.ruleAbove = true;
    separatorPending = false;
    blocks.push(block);
  }

  if (blocks.length === 0) throw new Error(`${file}: no text found.`);
  if (blocks[0].kind !== "title") throw new Error(`${file}: the first paragraph is not a centred title.`);
  return blocks;
}

// ---------------------------------------------------------------------------
// The module
// ---------------------------------------------------------------------------

function blockSource(block) {
  const parts = [`kind: ${JSON.stringify(block.kind)}`, `text: ${JSON.stringify(block.text)}`];
  if (block.bold) parts.push(`bold: [${block.bold.map(([start, end]) => `[${start}, ${end}]`).join(", ")}]`);
  if (block.center) parts.push("center: true");
  if (block.small) parts.push("small: true");
  if (block.indent) parts.push("indent: true");
  if (block.breakBefore) parts.push("breakBefore: true");
  if (block.ruleAbove) parts.push("ruleAbove: true");
  return `    { ${parts.join(", ")} },`;
}

const HEADER = `/**
 * GENERATED by scripts/generate-contracts.mjs from the firm's Word models in
 * docs/terms/. Do not edit by hand: the wording is the firm's and is never
 * retyped. To change it, replace the .docx and run
 *
 *   npm run contracts:generate
 *
 * One block per paragraph of the model, in the model's order. Tokens such as
 * [FULL NAME] stay in the text as written; src/content/contracts/variables.ts
 * knows every one of them. The models are the originals the firm sent on
 * 2026-09-21 with the changes Patrícia approved on 2026-09-24 (address, VAT,
 * numbering), applied by scripts/edit-contract-models.mjs, which also derives
 * the Couple package model from the package model. Anything else that looks
 * like a slip is the firm's own and is reported, not fixed here.
 *
 * CONTRACT_MODELS is the body of each model and only the body. The models
 * also have a letterhead outside it: a page header with the firm's logo and
 * a few lines of text, and a page footer with a drawing. Its text is exported
 * below as CONTRACT_LETTERHEAD and its logo in letterhead.generated.ts; the
 * PDF draws both on the first page of every contract.
 *
 * Plain data for the server: no React, no node imports. It is large, so keep
 * it out of client components.
 */

export type ContractBlockKind =
  | "title"
  | "subtitle"
  | "plain"
  /** FIRST CLAUSE */
  | "clause"
  /** The line under it: Nature of the Services */
  | "clauseTitle"
  /** 1. … */
  | "numbered"
  /** a) … */
  | "lettered"
  /** PART A … (Annex I) */
  | "partHeading"
  /** A tick box line of Annex I. The box is drawn, so the text leaves it out. */
  | "checkbox"
  | "signatureHeading"
  /** The First Party, */
  | "signatureLabel"
  /** The line printed under a signature rule. */
  | "signatureName"
  /** Place and date, and the Part C lines with underscores. */
  | "formLine";

export type ContractBlock = {
  kind: ContractBlockKind;
  text: string;
  /** Character ranges of \`text\` the model sets in bold, start inclusive, end exclusive. */
  bold?: readonly (readonly [number, number])[];
  /** The model centres the paragraph. */
  center?: true;
  /** Set smaller than the model's body text: a note or a caption. */
  small?: true;
  /** Moved in from the left margin. */
  indent?: true;
  /** The model starts a new page here. */
  breakBefore?: true;
  /** The model draws a thin rule between the paragraph before and this one. */
  ruleAbove?: true;
};

export type ContractModelId = ${MODELS.map(([id]) => JSON.stringify(id)).join(" | ")};
`;

const LETTERHEAD_COMMENT = `
/**
 * The text of each model's letterhead: the lines of its default page header
 * (the part the body's w:headerReference names), top to bottom. The PDF
 * prints them at the top right of the first page, beside the logo of
 * letterhead.generated.ts. The icon column beside them and the drawing in
 * the page footer are not reproduced.
 */
`;

const LETTERHEAD_HEADER = `/**
 * GENERATED by scripts/generate-contracts.mjs from the firm's Word models in
 * docs/terms/. Do not edit by hand: replace the .docx and run
 *
 *   npm run contracts:generate
 *
 * The logo of the models' letterhead, the widest picture of their page
 * header, which every model carries the same. The PDF of a contract draws it
 * at the top left of the first page, 30 mm wide (src/lib/contracts/
 * generate.ts). The model's picture is shrunk by a whole factor so it prints
 * sharp at that size without making every agreement carry the full file.
 *
 * Plain data for the server. It is some 35 KB of base64: keep it out of
 * client components.
 */
`;

/** Base64 in lines short enough to read in a diff. */
const BASE64_LINE = 100;

/** Everything the models give, read once: the blocks and letterhead of each. */
function readModels() {
  return MODELS.map(([id, file]) => {
    const buffer = readFileSync(join(TERMS, file));
    const xml = readZipEntry(buffer, DOCUMENT, file).toString("utf8");
    return { id, file, blocks: toBlocks(readParagraphs(xml, file), file), letterhead: readLetterhead(xml, buffer, file) };
  });
}

function moduleSource(models) {
  let source = HEADER;
  source += "\n/** The Word file each model was read from, in docs/terms/. */\n";
  source += "export const CONTRACT_MODEL_FILES: Record<ContractModelId, string> = {\n";
  for (const { id, file } of models) source += `  ${id}: ${JSON.stringify(file)},\n`;
  source += "};\n";

  source += "\nexport const CONTRACT_MODELS: Record<ContractModelId, readonly ContractBlock[]> = {\n";
  for (const { id, blocks } of models) source += `  ${id}: [\n${blocks.map(blockSource).join("\n")}\n  ],\n`;
  source += "};\n";

  source += LETTERHEAD_COMMENT;
  source += "export const CONTRACT_LETTERHEAD: Record<ContractModelId, readonly string[]> = {\n";
  for (const { id, letterhead } of models) {
    const { lines } = letterhead;
    source += lines.length === 0 ? `  ${id}: [],\n` : `  ${id}: [\n${lines.map((line) => `    ${JSON.stringify(line)},`).join("\n")}\n  ],\n`;
  }
  source += "};\n";
  return source;
}

/**
 * The logo module. Every model must embed the same logo, byte for byte: one
 * letterhead for every contract, or the script stops.
 */
function letterheadSource(models) {
  const withLogo = models.filter(({ letterhead }) => letterhead.logo);
  if (withLogo.length !== models.length) {
    const missing = models.filter(({ letterhead }) => !letterhead.logo).map(({ id }) => id);
    throw new Error(`No letterhead logo in the header of: ${missing.join(", ")}. Teach scripts/generate-contracts.mjs first.`);
  }
  const [first] = withLogo;
  for (const { id, letterhead } of withLogo) {
    if (Buffer.compare(letterhead.logo.bytes, first.letterhead.logo.bytes) !== 0) {
      throw new Error(`The ${id} model carries another logo than the ${first.id} model. One letterhead for every contract: settle it in the models first.`);
    }
  }

  const { media, bytes, width: drawnWidth, height: drawnHeight } = first.letterhead.logo;
  const original = decodePng(bytes, `${first.file} ${media}`);
  const factor = Math.max(1, Math.floor(original.width / LOGO_TARGET_WIDTH));
  const shrunk = downscale(original, factor);
  const png = encodePng(shrunk).toString("base64");
  const lines = [];
  for (let at = 0; at < png.length; at += BASE64_LINE) lines.push(`    ${JSON.stringify(png.slice(at, at + BASE64_LINE))},`);

  const mm = (emu) => (emu / 36000).toFixed(1);
  let source = LETTERHEAD_HEADER;
  source += "\nexport type LetterheadImage = {\n";
  source += "  /** Pixels. */\n  readonly width: number;\n  readonly height: number;\n";
  source += "  /** The PNG file, base64. */\n  readonly png: string;\n};\n";
  source += `\n/** From ${media} (${original.width} x ${original.height} px, drawn ${mm(drawnWidth)} x ${mm(drawnHeight)} mm in the models), shrunk by ${factor}. */\n`;
  source += "export const LETTERHEAD_LOGO: LetterheadImage = {\n";
  source += `  width: ${shrunk.width},\n  height: ${shrunk.height},\n`;
  source += `  png: [\n${lines.join("\n")}\n  ].join(""),\n};\n`;
  return source;
}

/** Once per run, whatever the mode, on stderr so --stdout stays the module and nothing else. */
function warnAboutPictures(models) {
  const left = models
    .map(({ id, letterhead }) => [id, letterhead.images - (letterhead.logo ? 1 : 0)])
    .filter(([, count]) => count > 0);
  if (left.length === 0) return;
  console.warn(
    `Letterhead pictures not reproduced: besides the logo, the models' page header and footer hold ` +
      `${left.map(([id, count]) => `${id}: ${count}`).join(", ")} (the icon column beside the text and the footer drawing). ` +
      "The PDF draws the logo and the header's text only.",
  );
}

/** The committed file, as git stores it: a Windows checkout may hold CRLF. */
function committed(path) {
  try {
    return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  } catch {
    return ""; // Missing counts as stale.
  }
}

const args = new Set(process.argv.slice(2));
const models = readModels();
const source = moduleSource(models);
warnAboutPictures(models);

if (args.has("--stdout")) {
  process.stdout.write(source);
} else if (args.has("--check")) {
  const stale = [];
  if (committed(OUT) !== source) stale.push("src/content/contracts/models.generated.ts");
  if (committed(LETTERHEAD_OUT) !== letterheadSource(models)) stale.push("src/content/contracts/letterhead.generated.ts");
  if (stale.length > 0) {
    console.error(`${stale.join(" and ")} ${stale.length === 1 ? "is" : "are"} stale. Run npm run contracts:generate.`);
    process.exit(1);
  }
  console.log("src/content/contracts/models.generated.ts and letterhead.generated.ts are up to date.");
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, source, "utf8");
  const letterhead = letterheadSource(models);
  writeFileSync(LETTERHEAD_OUT, letterhead, "utf8");
  const blocks = (source.match(/^ {4}\{ kind: /gm) ?? []).length;
  console.log(`Wrote ${blocks} blocks from ${MODELS.length} models to ${OUT}`);
  console.log(`Wrote the letterhead logo (${(letterhead.length / 1024).toFixed(1)} kB of source) to ${LETTERHEAD_OUT}`);
}
