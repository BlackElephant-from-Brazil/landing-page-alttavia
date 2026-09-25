import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";

import {
  buildPowerOfAttorney,
  isJointPrincipals,
  type JointPrincipals,
  type PoaBlock,
  type PrincipalDetails,
  type SigningDate,
} from "@/content/power-of-attorney";
import type { PoaTemplate } from "@/lib/db/types";
import { INK_SOFT, Layout, foldToPlain, transliterate } from "@/lib/pdf/layout";

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
 *
 * The page cursor, the word wrap and the folding of characters the fonts
 * cannot encode live in src/lib/pdf/layout.ts, shared with the contracts.
 * A deed folds typographic quotes and dashes to their plain forms
 * (foldToPlain), as it always has.
 *
 * The principal's own fields are prepared before the deed is built
 * (printable): a value holding a letter the fonts lack is spelled in plain
 * ASCII letters throughout, as a passport's machine readable line would, so
 * "Łukasz Żółć" prints "Lukasz Zolc" in the deed and in the service agreement
 * alike, never half accented. It is done on the values, not inside the wrap,
 * so the firm's wording is set exactly as before.
 */

const MARGIN = { top: 56, bottom: 52, left: 62, right: 62 };

/**
 * Tuned so the NIF deed lands on a single A4 sheet, filled or blank, and the
 * bank deed on two. A power of attorney that spills a lone signature onto an
 * extra page reads as a mistake to whoever receives it, and tests pin both
 * page counts so a future copy edit cannot quietly reintroduce that. The
 * couple's joint bank deed, with a second identification clause and a second
 * signature, is pinned at three at most.
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

/**
 * What each signature after the first adds to that block: the gap for the
 * handwriting, the rule and a printed name of up to two lines. The joint
 * bank deed ends with two signatures, and both stay with the closing line.
 */
const EXTRA_SIGNATURE_RESERVE = 80;

/** The PDF subject line per deed, for the reader's document properties. */
const SUBJECT: Record<PoaTemplate, string> = {
  poa_nif: "Atribuição de Número de Identificação Fiscal (NIF)",
  poa_bank: "Abertura de conta bancária em Portugal",
};

type Fonts = { regular: PDFFont; italic: PDFFont; bold: PDFFont };

function render(layout: Layout, blocks: PoaBlock[], fonts: Fonts) {
  // The last paragraph before the signature is the closing line; it and the
  // signature are kept on the same page.
  const closing = blocks.findIndex((block, i) => block.kind === "paragraph" && blocks[i + 1]?.kind === "signature");
  const signatures = blocks.filter((block) => block.kind === "signature").length;
  const reserve = CLOSING_RESERVE + EXTRA_SIGNATURE_RESERVE * Math.max(0, signatures - 1);

  blocks.forEach((block, i) => {
    if (i === closing) layout.reserve(reserve);
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

/** Every field of the principal but the gender: free text, or a date typed by hand. */
const TEXT_FIELDS = [
  "fullName",
  "birthPlace",
  "birthDate",
  "passportNumber",
  "passportIssuer",
  "passportIssueDate",
  "passportExpiryDate",
  "taxAddress",
] as const;

/** The principal's fields as the deed prints them: see transliterate in src/lib/pdf/characters.ts. */
export function printable(principal: PrincipalDetails): PrincipalDetails {
  const out: PrincipalDetails = { ...principal };
  for (const field of TEXT_FIELDS) {
    const value = out[field];
    if (typeof value === "string") out[field] = transliterate(value);
  }
  return out;
}

/**
 * Builds one deed. Called with only the kind it produces the blank template,
 * every field showing the model's own bracketed placeholder. For the
 * couple's joint bank deed pass both principals, `[first, second]`, in
 * applicant order (buildPowerOfAttorney says what changes); a pair on the
 * NIF deed throws.
 */
export async function generatePowerOfAttorney(
  kind: PoaTemplate,
  principals: PrincipalDetails | JointPrincipals = {},
  signedOn: SigningDate = {},
): Promise<Uint8Array> {
  const prepared: PrincipalDetails | JointPrincipals = isJointPrincipals(principals)
    ? [printable(principals[0]), printable(principals[1])]
    : printable(principals);

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

  const layout = new Layout(doc, {
    margin: MARGIN,
    leading: LEADING.body,
    itemIndent: ITEM_INDENT,
    fold: foldToPlain,
  });
  render(layout, buildPowerOfAttorney(kind, prepared, signedOn), fonts);
  return doc.save();
}
