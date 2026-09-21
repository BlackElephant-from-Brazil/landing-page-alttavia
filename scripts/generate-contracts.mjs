#!/usr/bin/env node
/**
 * Writes src/content/contracts/models.generated.ts from the firm's Word
 * models in docs/terms/, so the contract PDF says what the models say. The
 * wording is never retyped: change a .docx, run this, commit both.
 *
 *   npm run contracts:generate               write the module
 *   npm run contracts:generate -- --check    exit 1 when the module is stale
 *   npm run contracts:generate -- --stdout   print the module, write nothing
 *
 * A .docx is a zip. Its entries are found through the central directory and
 * inflated with node's own zlib, so there is no dependency to install. The
 * body, word/document.xml, is walked tag by tag: a paragraph's text is its
 * runs joined (Word splits a run wherever it likes, often inside a word),
 * entities are decoded, tabs and line breaks become a space, and the bold
 * runs are kept as character ranges because the models use bold to make the
 * waivers conspicuous.
 *
 * What the script cannot read in the BODY (a table, automatic numbering, a
 * symbol run, a drawing) stops it with an error instead of quietly dropping
 * text from a legal document.
 *
 * The LETTERHEAD is another matter, and this is everything the module leaves
 * out. Each model has a page header and a page footer outside the body: the
 * body's section properties (w:headerReference, w:footerReference, type
 * "default") name a relationship id, word/_rels/document.xml.rels turns it
 * into a part (word/header2.xml, word/footer1.xml). The header holds the
 * firm's logo as two pictures and a text box with a phone number, an email
 * address, a URL and an office address; the footer holds one drawing. The
 * script resolves both parts and exports the header's text, line by line, as
 * CONTRACT_LETTERHEAD. The pictures are NOT extracted and nothing of the
 * letterhead is drawn in the PDF today: whether the client's copy carries
 * one is an open question for the firm. A run warns about the pictures once.
 * A footer that gains text, or a model with a different first page or even
 * page header, stops the script: that would be wording nobody exported.
 *
 * docs/agreement-contract.md section 3 is the design.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TERMS = join(ROOT, "docs", "terms");
const OUT = join(ROOT, "src", "content", "contracts", "models.generated.ts");

/** Model id, then the file the firm sent. The order is the order of the module. */
const MODELS = [
  ["nif", "MODELO - Contract for Legal Services - NIF (blank fields).docx"],
  ["bank", "MODELO - Contract for Legal Services - Bank Account (blank fields).docx"],
  ["package", "MODELO - Contract for Legal Services - NIF + Bank Account Package (blank fields).docx"],
  ["annex", "MODELO - Annex I - Immediate Commencement and Withdrawal (blank fields).docx"],
];

// ---------------------------------------------------------------------------
// Zip
// ---------------------------------------------------------------------------

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/** Returns one entry of a zip archive, inflated. */
function readZipEntry(buffer, name, file) {
  let eocd = -1;
  const floor = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= floor; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(`${file}: not a zip archive (no end of central directory).`);

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  for (let n = 0; n < count; n++) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new Error(`${file}: broken central directory at entry ${n}.`);
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const entryName = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);

    if (entryName === name) {
      if (buffer.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
        throw new Error(`${file}: broken local header for ${name}.`);
      }
      // The local header repeats the name and carries its own extra field,
      // whose length may differ from the central one.
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const data = buffer.subarray(start, start + compressedSize);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return inflateRawSync(data);
      throw new Error(`${file}: ${name} uses zip method ${method}, only stored and deflate are read.`);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`${file}: no ${name} inside.`);
}

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

const RELATIONSHIPS = "word/_rels/document.xml.rels";
const SETTINGS = "word/settings.xml";

/** Relationship id to part name ("rId8" to "word/header2.xml"), from the body's relationships. */
function readRelationships(buffer, file) {
  const xml = readZipEntry(buffer, RELATIONSHIPS, file).toString("utf8");
  const parts = new Map();
  for (const match of xml.matchAll(TAGS)) {
    const [, closing, tag, attributes = ""] = match;
    if (closing || tag !== "Relationship") continue;
    const id = attribute(attributes, "Id");
    const target = attribute(attributes, "Target");
    if (!id || !target || attribute(attributes, "TargetMode") === "External") continue;
    parts.set(id, target.startsWith("/") ? target.slice(1) : `word/${target}`);
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

  const relationships = readRelationships(buffer, file);
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
    if (!part) throw new Error(`${file}: ${kind} reference ${id} is not in ${RELATIONSHIPS}.`);
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

/** `{ lines, images }` for one model: the header's text, and the pictures of header and footer together. */
function readLetterhead(documentXml, buffer, file) {
  const parts = letterheadParts(documentXml, buffer, file);
  const header = parts.header ? readLetterheadPart(readZipEntry(buffer, parts.header, file).toString("utf8")) : { lines: [], images: 0 };
  const footer = parts.footer ? readLetterheadPart(readZipEntry(buffer, parts.footer, file).toString("utf8")) : { lines: [], images: 0 };
  if (footer.lines.length > 0) {
    throw new Error(`${file}: the page footer holds text ("${footer.lines[0]}"). Teach scripts/generate-contracts.mjs to export it first.`);
  }
  return { lines: header.lines, images: header.images + footer.images };
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
 * knows every one of them. Numbering gaps and anything else that looks like
 * a slip are the models' own and are reported to the firm, not fixed here.
 *
 * CONTRACT_MODELS is the body of each model and only the body. The models
 * also have a letterhead outside it: a page header with the firm's logo and
 * a few lines of text, and a page footer with a drawing. Its text is exported
 * below as CONTRACT_LETTERHEAD; its pictures are not extracted, and the PDF
 * generator draws none of it for now (an open question for the firm).
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

export type ContractModelId = "nif" | "bank" | "package" | "annex";
`;

const LETTERHEAD_COMMENT = `
/**
 * The text of each model's letterhead: the lines of its default page header
 * (the part the body's w:headerReference names), top to bottom. Text only.
 * The logo beside it and the drawing in the page footer are pictures and are
 * not extracted. Nothing here is drawn in the PDF today; it is kept so the
 * wording is on record and a changed letterhead fails models.test.ts.
 */
`;

function moduleSource() {
  let source = HEADER;
  source += "\n/** The Word file each model was read from, in docs/terms/. */\n";
  source += "export const CONTRACT_MODEL_FILES: Record<ContractModelId, string> = {\n";
  for (const [id, file] of MODELS) source += `  ${id}: ${JSON.stringify(file)},\n`;
  source += "};\n";

  const letterheads = [];
  source += "\nexport const CONTRACT_MODELS: Record<ContractModelId, readonly ContractBlock[]> = {\n";
  for (const [id, file] of MODELS) {
    const buffer = readFileSync(join(TERMS, file));
    const xml = readZipEntry(buffer, "word/document.xml", file).toString("utf8");
    const blocks = toBlocks(readParagraphs(xml, file), file);
    source += `  ${id}: [\n${blocks.map(blockSource).join("\n")}\n  ],\n`;
    letterheads.push([id, readLetterhead(xml, buffer, file)]);
  }
  source += "};\n";

  source += LETTERHEAD_COMMENT;
  source += "export const CONTRACT_LETTERHEAD: Record<ContractModelId, readonly string[]> = {\n";
  for (const [id, { lines }] of letterheads) {
    source += lines.length === 0 ? `  ${id}: [],\n` : `  ${id}: [\n${lines.map((line) => `    ${JSON.stringify(line)},`).join("\n")}\n  ],\n`;
  }
  source += "};\n";

  // Once per run, whatever the mode, on stderr so --stdout stays the module and nothing else.
  const pictures = letterheads.filter(([, { images }]) => images > 0);
  if (pictures.length > 0) {
    const detail = pictures.map(([id, { images }]) => `${id}: ${images}`).join(", ");
    console.warn(
      `Letterhead images are not reproduced: the pictures in the models' page header and footer (${detail}) are left out. ` +
        "Only the header's text is exported, as CONTRACT_LETTERHEAD, and the PDF draws none of it.",
    );
  }
  return source;
}

const args = new Set(process.argv.slice(2));
const source = moduleSource();

if (args.has("--stdout")) {
  process.stdout.write(source);
} else if (args.has("--check")) {
  let current = "";
  try {
    // A Windows checkout may hold the file with CRLF; git stores LF.
    current = readFileSync(OUT, "utf8").replace(/\r\n/g, "\n");
  } catch {
    // Missing counts as stale.
  }
  if (current !== source) {
    console.error("src/content/contracts/models.generated.ts is stale. Run npm run contracts:generate.");
    process.exit(1);
  }
  console.log("src/content/contracts/models.generated.ts is up to date.");
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, source, "utf8");
  const blocks = (source.match(/^ {4}\{ kind: /gm) ?? []).length;
  console.log(`Wrote ${blocks} blocks from ${MODELS.length} models to ${OUT}`);
}
