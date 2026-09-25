#!/usr/bin/env node
/**
 * Rewrites the firm's four Word models in docs/terms/ from the originals the
 * firm sent on 2026-09-21 (kept untouched in docs/terms/originais-2026-09-21/)
 * with the changes Patrícia approved on 2026-09-24, and derives the fifth
 * model, the Couple package, from the package model. Nothing else in the
 * wording moves.
 *
 *   node scripts/edit-contract-models.mjs            write the five models
 *   node scripts/edit-contract-models.mjs --check    exit 1 when docs/terms differs from what this writes
 *   node scripts/edit-contract-models.mjs --dry-run  print the changes, write nothing
 *   node scripts/edit-contract-models.mjs --help     print the usage, write nothing
 *
 * Any other option is refused with exit 2 before anything is built or
 * written.
 *
 * Then `npm run contracts:generate` reads the models into
 * src/content/contracts/models.generated.ts, as always.
 *
 * Her answers, as applied here:
 *   (a) The registered office of the Second Party becomes the address of the
 *       powers of attorney. Every "Av. Elias Garcia, 123-A, 1050-098 Lisbon,
 *       Portugal" becomes "Av. António Augusto Aguiar, 24, 1st floor right,
 *       Office 3, 1050-016 Lisbon, Portugal": the parties paragraph of the
 *       three contracts and the addressee line of Annex I, Part C.
 *   (b) The price on the site already includes VAT: "plus VAT at the legal
 *       rate where applicable under Portuguese tax law" becomes "VAT
 *       included" (Fourth Clause, paragraph 1, of the three contracts).
 *   (c) The numbering gaps go: every clause counts its paragraphs 1, 2, 3
 *       with no gap (NIF: Seventh and Ninth Clauses; bank: Ninth Clause).
 *       Only the leading number of the paragraph changes.
 *   (d) The Couple package gets one contract for both persons: the package
 *       model with the package named "Couple Package" in the subtitle, the
 *       First Party paragraph naming two persons, and a second First Party
 *       signature line. Our drafting, for the firm to read.
 *
 * Each change states how many times it must apply per model, and the script
 * stops when a model does not match: a changed original is a reason to look
 * again, not to guess.
 *
 * How the XML is edited. word/document.xml is changed as text, never parsed
 * and serialised again, so everything the script does not touch stays byte
 * for byte. Word splits a sentence into runs wherever it likes, so a phrase
 * is found in the paragraph's text with its runs joined; the replacement goes
 * into the run where the phrase starts, and the rest of the phrase is taken
 * out of the runs it spanned. A phrase whose runs are formatted differently
 * stops the script, because the replacement could only take one face.
 *
 * How the zip is written: see scripts/lib/zip.mjs. Every entry but
 * word/document.xml is copied compressed as it came, and document.xml is
 * deflated by an encoder whose output depends on its input alone, so the
 * same originals always give the same bytes.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { entryBytes, readZip, replaceEntry, writeZip } from "./lib/zip.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TERMS = join(ROOT, "docs", "terms");
const ORIGINALS = join(TERMS, "originais-2026-09-21");
const DOCUMENT = "word/document.xml";

const FILES = {
  nif: "MODELO - Contract for Legal Services - NIF (blank fields).docx",
  bank: "MODELO - Contract for Legal Services - Bank Account (blank fields).docx",
  package: "MODELO - Contract for Legal Services - NIF + Bank Account Package (blank fields).docx",
  annex: "MODELO - Annex I - Immediate Commencement and Withdrawal (blank fields).docx",
};
const COUPLE_FILE = "MODELO - Contract for Legal Services - Couple Package (blank fields).docx";

const ADDRESS_OLD = "Av. Elias Garcia, 123-A, 1050-098 Lisbon, Portugal";
const ADDRESS_NEW = "Av. António Augusto Aguiar, 24, 1st floor right, Office 3, 1050-016 Lisbon, Portugal";
const VAT_OLD = "plus VAT at the legal rate where applicable under Portuguese tax law";
const VAT_NEW = "VAT included";

/** The phrases replaced, and how many times each model must hold them. */
const REPLACEMENTS = [
  { find: ADDRESS_OLD, replace: ADDRESS_NEW, expect: { nif: 1, bank: 1, package: 1, annex: 1 } },
  { find: VAT_OLD, replace: VAT_NEW, expect: { nif: 1, bank: 1, package: 1, annex: 0 } },
];

/** The paragraphs renumbered, as the originals of 2026-09-21 have them. Anything else stops the script. */
const EXPECTED_RENUMBERING = {
  nif: ["SEVENTH CLAUSE 4 -> 3", "NINTH CLAUSE 4 -> 3"],
  bank: ["NINTH CLAUSE 3 -> 2", "NINTH CLAUSE 4 -> 3"],
  package: [],
  annex: [],
};

// ---------------------------------------------------------------------------
// Paragraph text over runs
// ---------------------------------------------------------------------------

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === "#") {
      return String.fromCodePoint(body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10));
    }
    if (!(body in ENTITIES)) throw new Error(`Unknown XML entity ${whole}.`);
    return ENTITIES[body];
  });
}

function encode(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** One body paragraph, self closing or not. Body paragraphs do not nest in these models (no text boxes). */
const PARAGRAPH = /<w:p\b[^>]*?(?:\/>|>[\s\S]*?<\/w:p>)/g;
const TEXT = /<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g;

/** The text elements of a paragraph: where each sits in the XML, its attributes and its decoded text. */
function pieces(paragraph) {
  const out = [];
  let at = 0;
  for (const match of paragraph.matchAll(TEXT)) {
    const text = decode(match[2]);
    out.push({ start: match.index, end: match.index + match[0].length, attributes: match[1] ?? "", text, from: at, to: at + text.length });
    at += text.length;
  }
  return out;
}

function textOf(paragraph) {
  return pieces(paragraph)
    .map((piece) => piece.text)
    .join("");
}

/** The run properties of the run holding a text element: what decides its face. */
function runPropertiesAt(paragraph, position) {
  const before = paragraph.slice(0, position);
  const runStart = Math.max(before.lastIndexOf("<w:r>"), before.lastIndexOf("<w:r "));
  if (runStart < 0) throw new Error("A text element outside a run.");
  const run = before.slice(runStart);
  return /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(run)?.[0] ?? "";
}

function textElement(attributes, text) {
  // Leading or trailing spaces need xml:space="preserve", or Word drops them.
  const needsPreserve = /^\s|\s$/.test(text) && !/xml:space="preserve"/.test(attributes);
  return `<w:t${attributes}${needsPreserve ? ' xml:space="preserve"' : ""}>${encode(text)}</w:t>`;
}

/**
 * Replaces the characters `from` to `to` of the paragraph's joined text with
 * `replacement`. The replacement goes into the text element where the range
 * starts; the rest of the range is removed from the elements it spans.
 */
function replaceRange(paragraph, from, to, replacement) {
  const all = pieces(paragraph);
  const spanned = all.filter((piece) => piece.to > from && piece.from < to);
  if (spanned.length === 0) throw new Error(`Nothing at ${from} to ${to} in "${textOf(paragraph).slice(0, 60)}".`);
  const faces = new Set(spanned.map((piece) => runPropertiesAt(paragraph, piece.start)));
  if (faces.size > 1) {
    throw new Error(`"${textOf(paragraph).slice(from, to)}" spans runs formatted differently; the replacement could take only one face.`);
  }

  let out = "";
  let last = 0;
  spanned.forEach((piece, index) => {
    const keepBefore = piece.text.slice(0, Math.max(0, from - piece.from));
    const keepAfter = piece.text.slice(Math.min(piece.text.length, to - piece.from));
    const text = (index === 0 ? keepBefore + replacement : "") + keepAfter;
    out += paragraph.slice(last, piece.start) + textElement(piece.attributes, text);
    last = piece.end;
  });
  return out + paragraph.slice(last);
}

/** Every paragraph of the body with its index in the XML, in order. */
function paragraphs(xml) {
  return [...xml.matchAll(PARAGRAPH)].map((match) => {
    if (/<w:p[\s>]/.test(match[0].slice(4))) throw new Error("A paragraph inside a paragraph (a text box?); teach scripts/edit-contract-models.mjs first.");
    return { start: match.index, end: match.index + match[0].length, xml: match[0] };
  });
}

/** Applies `edit(paragraphXml, text)` to every paragraph; returns the new document. */
function mapParagraphs(xml, edit) {
  let out = "";
  let last = 0;
  for (const paragraph of paragraphs(xml)) {
    out += xml.slice(last, paragraph.start) + edit(paragraph.xml, textOf(paragraph.xml));
    last = paragraph.end;
  }
  return out + xml.slice(last);
}

// ---------------------------------------------------------------------------
// The edits
// ---------------------------------------------------------------------------

/** Replaces every occurrence of `find`, counting them. */
function replacePhrase(xml, find, replace, changes, model) {
  let count = 0;
  const edited = mapParagraphs(xml, (paragraph, text) => {
    let current = paragraph;
    let index = text.lastIndexOf(find);
    // From the end, so earlier positions stay valid.
    while (index >= 0) {
      current = replaceRange(current, index, index + find.length, replace);
      count += 1;
      changes.push({ model, before: text, after: textOf(current) });
      index = index === 0 ? -1 : text.lastIndexOf(find, index - 1);
    }
    return current;
  });
  return { xml: edited, count };
}

const CLAUSE = /^[A-Z]+(?:-[A-Z]+)* CLAUSE$/;
const PART = /^PART [A-Z]\b/;
const NUMBERED = /^(\s*)(\d+)\.\s/;

/** Makes every clause count its numbered paragraphs 1, 2, 3; returns what moved. */
function renumber(xml, changes, model) {
  let heading = "";
  let expected = 0;
  const moved = [];
  const edited = mapParagraphs(xml, (paragraph, text) => {
    const trimmed = text.trim();
    if (CLAUSE.test(trimmed) || PART.test(trimmed)) {
      heading = trimmed;
      expected = 0;
      return paragraph;
    }
    const match = NUMBERED.exec(text);
    if (!match || !heading) return paragraph;
    expected += 1;
    const number = Number(match[2]);
    if (number === expected) return paragraph;
    const from = match[1].length;
    const updated = replaceRange(paragraph, from, from + match[2].length, String(expected));
    moved.push(`${heading} ${number} -> ${expected}`);
    changes.push({ model, before: text, after: textOf(updated) });
    return updated;
  });
  return { xml: edited, moved };
}

function assertCount(model, what, count, expected) {
  if (count !== expected) {
    throw new Error(`${FILES[model] ?? model}: expected ${expected} of "${what}", found ${count}. The original changed; read it before editing this script.`);
  }
}

/** The four models with answers (a), (b) and (c) applied. */
function editModel(model, xml, changes) {
  let current = xml;
  for (const { find, replace, expect } of REPLACEMENTS) {
    const result = replacePhrase(current, find, replace, changes, model);
    assertCount(model, find, result.count, expect[model]);
    current = result.xml;
  }
  const { xml: renumbered, moved } = renumber(current, changes, model);
  if (JSON.stringify(moved) !== JSON.stringify(EXPECTED_RENUMBERING[model])) {
    throw new Error(`${FILES[model]}: renumbering would move ${JSON.stringify(moved)}, expected ${JSON.stringify(EXPECTED_RENUMBERING[model])}.`);
  }
  for (const leftover of ["Elias Garcia", "plus VAT"]) {
    if (textOfDocument(renumbered).includes(leftover)) throw new Error(`${FILES[model]}: "${leftover}" is still in the model.`);
  }
  return renumbered;
}

function textOfDocument(xml) {
  return paragraphs(xml)
    .map((paragraph) => textOf(paragraph.xml))
    .join("\n");
}

// ---------------------------------------------------------------------------
// The Couple package, derived from the edited package model
// ---------------------------------------------------------------------------

const PACKAGE_NAME_OLD = "(Combined Package — ";
const PACKAGE_NAME_NEW = "(Couple Package — ";
const PARTY_ENDING = ", with email address [EMAIL], hereinafter referred to as the First Party or Client;";
const COUPLE_ENDING = ", both with email address [EMAIL], hereinafter jointly referred to as the First Party or Client;";

/** The second person's token for each of the first person's: [FULL NAME] -> [FULL NAME 2]. */
function secondPerson(text) {
  return text.replace(/\[([^\[\]]+)\]/g, "[$1 2]");
}

function openingTag(xml, tag) {
  const match = new RegExp(`^<${tag}\\b[^>]*>`).exec(xml);
  if (!match) throw new Error(`No <${tag}> at the start of ${xml.slice(0, 40)}.`);
  return match[0];
}

/** The run (from its opening tag to its closing one) holding the text element at `position`. */
function runAt(paragraph, position) {
  const before = paragraph.slice(0, position);
  const start = Math.max(before.lastIndexOf("<w:r>"), before.lastIndexOf("<w:r "));
  const end = paragraph.indexOf("</w:r>", position);
  return paragraph.slice(start, end + "</w:r>".length);
}

function run(template, text) {
  const open = openingTag(template, "w:r");
  const properties = /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(template)?.[0] ?? "";
  return `${open}${properties}${textElement("", text)}</w:r>`;
}

/**
 * The First Party paragraph for two persons. The first person keeps the
 * model's words; the second repeats them with the "2" tokens; the email is
 * the account's, shared. Faces as in the model: the names bold, the rest
 * regular.
 */
function coupleParties(paragraph, text, changes) {
  if (!text.startsWith("[FULL NAME]") || !text.endsWith(PARTY_ENDING)) {
    throw new Error(`The package model's First Party paragraph changed: "${text.slice(0, 80)}…".`);
  }
  const all = pieces(paragraph);
  const name = all.find((piece) => piece.text.includes("[FULL NAME]"));
  const rest = all.find((piece) => piece.text.includes(", born in"));
  if (!name || !rest || !/<w:b\/>/.test(runPropertiesAt(paragraph, name.start))) {
    throw new Error("The package model's First Party paragraph is not a bold name followed by regular text.");
  }
  const boldRun = runAt(paragraph, name.start);
  const regularRun = runAt(paragraph, rest.start);

  const person = text.slice("[FULL NAME]".length, text.length - PARTY_ENDING.length);
  const runs = [
    run(boldRun, "[FULL NAME]"),
    run(regularRun, `${person}, and `),
    run(boldRun, secondPerson("[FULL NAME]")),
    run(regularRun, `${secondPerson(person)}${COUPLE_ENDING}`),
  ];
  const properties = /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(paragraph)?.[0] ?? "";
  const rebuilt = `${openingTag(paragraph, "w:p")}${properties}${runs.join("")}</w:p>`;
  changes.push({ model: "couple", before: text, after: textOf(rebuilt) });
  return rebuilt;
}

/** A copy of a paragraph that Word will not mistake for the original: no paragraph ids. */
function cloneParagraph(paragraph) {
  return paragraph.replace(/\s(?:w14:paraId|w14:textId)="[^"]*"/g, "");
}

/** Adds space above a paragraph (in twentieths of a point), so there is room to sign above a rule. */
function withSpaceBefore(paragraph, twips) {
  if (/<w:spacing\b[^>]*\sw:before="/.test(paragraph)) return paragraph.replace(/(<w:spacing\b[^>]*\sw:before=")\d+"/, `$1${twips}"`);
  if (/<w:spacing\b/.test(paragraph)) return paragraph.replace(/<w:spacing\b/, `<w:spacing w:before="${twips}"`);
  return paragraph.replace(/<w:pPr>/, `<w:pPr><w:spacing w:before="${twips}"/>`);
}

function deriveCouple(packageXml, changes) {
  // The subtitle names the package.
  const named = replacePhrase(packageXml, PACKAGE_NAME_OLD, PACKAGE_NAME_NEW, changes, "couple");
  assertCount("couple", PACKAGE_NAME_OLD, named.count, 1);

  // The First Party paragraph names two persons.
  let parties = 0;
  const xml = mapParagraphs(named.xml, (paragraph, text) => {
    if (!text.endsWith(PARTY_ENDING)) return paragraph;
    parties += 1;
    return coupleParties(paragraph, text, changes);
  });
  assertCount("couple", "the First Party paragraph", parties, 1);

  // A second First Party signature line: the rule and the name under it, again, for the partner.
  const list = paragraphs(xml);
  const texts = list.map((paragraph) => textOf(paragraph.xml));
  const heading = texts.indexOf("SIGNATURES");
  const label = texts.indexOf("The First Party,", heading);
  const rule = label + 1;
  const name = label + 2;
  if (heading < 0 || label < 0 || !/<w:pBdr>/.test(list[rule]?.xml ?? "") || texts[rule].trim() !== "" || texts[name] !== "[FULL NAME]") {
    throw new Error("The package model's signature block changed: expected The First Party, a signature rule and [FULL NAME].");
  }
  const partnerRule = withSpaceBefore(cloneParagraph(list[rule].xml), 480);
  const partnerName = replaceRange(cloneParagraph(list[name].xml), 0, "[FULL NAME]".length, secondPerson("[FULL NAME]"));
  changes.push({ model: "couple", before: "(signature block) The First Party, / [FULL NAME]", after: "(signature block) The First Party, / [FULL NAME] / [FULL NAME 2]" });

  const at = list[name].end;
  return xml.slice(0, at) + partnerRule + partnerName + xml.slice(at);
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

function readOriginal(model) {
  const file = join(ORIGINALS, FILES[model]);
  if (!existsSync(file)) throw new Error(`Missing original: ${file}. The originals of 2026-09-21 are the input of this script.`);
  const buffer = readFileSync(file);
  const entries = readZip(buffer, FILES[model]);
  const document = entries.find((entry) => entry.name === DOCUMENT);
  if (!document) throw new Error(`${FILES[model]}: no ${DOCUMENT} inside.`);
  return { entries, xml: entryBytes(document, FILES[model]).toString("utf8") };
}

function withDocument(entries, xml) {
  return writeZip(entries.map((entry) => (entry.name === DOCUMENT ? replaceEntry(entry, Buffer.from(xml, "utf8")) : entry)));
}

/** Every model this script writes: `[[file name, bytes]]`, and the list of paragraph changes. */
export function buildModels() {
  const changes = [];
  const outputs = [];
  let packageEdited = null;

  for (const model of ["nif", "bank", "package", "annex"]) {
    const { entries, xml } = readOriginal(model);
    const edited = editModel(model, xml, changes);
    outputs.push([FILES[model], withDocument(entries, edited)]);
    if (model === "package") packageEdited = { entries, xml: edited };
  }
  outputs.push([COUPLE_FILE, withDocument(packageEdited.entries, deriveCouple(packageEdited.xml, changes))]);
  return { outputs, changes };
}

const USAGE = `Usage:
  node scripts/edit-contract-models.mjs            write the five models into docs/terms
  node scripts/edit-contract-models.mjs --check    exit 1 when docs/terms differs from what this writes
  node scripts/edit-contract-models.mjs --dry-run  print the changes, write nothing
  node scripts/edit-contract-models.mjs --help     print this, write nothing`;

const KNOWN_FLAGS = new Set(["--check", "--dry-run", "--help", "-h"]);

function main() {
  const args = new Set(process.argv.slice(2));
  // Refused before anything is built or written (2026-09-25): an unknown
  // flag, --help included, used to fall through to the write.
  const unknown = [...args].filter((arg) => !KNOWN_FLAGS.has(arg));
  if (unknown.length > 0) {
    console.error(`Unknown option: ${unknown.join(", ")}. Nothing was written.\n\n${USAGE}`);
    process.exit(2);
  }
  if (args.has("--help") || args.has("-h")) {
    console.log(USAGE);
    return;
  }

  const { outputs, changes } = buildModels();

  if (args.has("--check")) {
    const stale = outputs.filter(([file, bytes]) => {
      const path = join(TERMS, file);
      return !existsSync(path) || Buffer.compare(readFileSync(path), bytes) !== 0;
    });
    if (stale.length > 0) {
      console.error(`Not what scripts/edit-contract-models.mjs writes: ${stale.map(([file]) => file).join(", ")}. Run node scripts/edit-contract-models.mjs.`);
      process.exit(1);
    }
    console.log("docs/terms holds the edited models, byte for byte.");
    return;
  }

  for (const { model, before, after } of changes) {
    console.log(`\n[${model}]\n  - ${before}\n  + ${after}`);
  }
  if (args.has("--dry-run")) return;

  mkdirSync(TERMS, { recursive: true });
  for (const [file, bytes] of outputs) {
    writeFileSync(join(TERMS, file), bytes);
    console.log(`\nWrote docs/terms/${file} (${(bytes.length / 1024).toFixed(1)} kB)`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
