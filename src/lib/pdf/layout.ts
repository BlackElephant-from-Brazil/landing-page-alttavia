import {
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setWordSpacing,
  type PDFDocument,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import { foldToPlain, foldToWinAnsi, type Fold } from "./characters";

/**
 * What the powers of attorney (src/lib/poa/generate.ts) and the service
 * contracts (src/lib/contracts/generate.ts) share: the A4 page cursor, word
 * wrap, hanging indents and the folding of characters the standard PDF fonts
 * cannot encode.
 *
 * Two families live here. The plain one (`wrap`, `Layout.text`, `Layout.item`,
 * `Layout.rule`) is the deeds' code moved as it was: their page counts are
 * pinned by tests and nothing about their output may change. The rich one
 * (`wrapSpans`, `Layout.lines`) sets a paragraph in more than one face and can
 * justify it, which the contracts need for the bold the firm's models use.
 *
 * No filesystem, no network: everything here runs the same in a script, in a
 * route handler or in a test.
 */

export const A4 = { width: 595.28, height: 841.89 };

export const INK = rgb(0.05, 0.09, 0.15);
export const INK_SOFT = rgb(0.28, 0.33, 0.4);

export type Color = ReturnType<typeof rgb>;
export type Margins = { top: number; bottom: number; left: number; right: number };

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

/**
 * The standard PDF fonts encode WinAnsi, which covers Portuguese accents but
 * not every character a word processor or a passport may have introduced.
 * The tables, the two folds and what a form may refuse live in
 * ./characters.ts, which imports nothing, so a client component can ask
 * whether a name is printable without bundling pdf-lib. They are re-exported
 * here because everything that draws text needs them.
 */
export { asciiLetters, foldToPlain, foldToWinAnsi, transliterate, unprintable, type Fold } from "./characters";

// ---------------------------------------------------------------------------
// Plain wrap (one face per paragraph)
// ---------------------------------------------------------------------------

/** Splits `text` into lines that fit `width` at `size`. */
export function wrap(text: string, font: PDFFont, size: number, width: number, foldText: Fold = foldToPlain): string[] {
  const words = foldText(text).split(/\s+/).filter(Boolean);
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

// ---------------------------------------------------------------------------
// Rich wrap (several faces in one paragraph, optionally justified)
// ---------------------------------------------------------------------------

/** A stretch of text in one face. A paragraph is a list of them. */
export type Span = { text: string; font: PDFFont };

/** One set line: runs to draw left to right, each in its own face. */
export type WrappedLine = {
  runs: Span[];
  /** Width as drawn, spaces included. */
  width: number;
  /** Spaces between words, the places a justified line can stretch. */
  spaces: number;
  /** False on the last line of a paragraph, which is never stretched. */
  stretch: boolean;
};

/**
 * Advance widths per face and character, in units of the font size. pdf-lib's
 * own widthOfTextAtSize subtracts kerning that drawText never applies, so a
 * line measured with it is drawn a little wider than reported. Invisible on
 * a ragged right edge, not on a justified one, so the rich path adds up the
 * glyphs it will really get.
 */
const ADVANCES = new WeakMap<PDFFont, Map<string, number>>();

export function measure(text: string, font: PDFFont, size: number): number {
  let table = ADVANCES.get(font);
  if (!table) {
    table = new Map();
    ADVANCES.set(font, table);
  }
  let total = 0;
  for (const char of text) {
    let advance = table.get(char);
    if (advance === undefined) {
      advance = font.widthOfTextAtSize(char, 1);
      table.set(char, advance);
    }
    total += advance;
  }
  return total * size;
}

type Word = { pieces: Span[]; width: number };

function wordWidth(pieces: Span[], size: number): number {
  return pieces.reduce((sum, piece) => sum + measure(piece.text, piece.font, size), 0);
}

/** Cuts the spans into words. A word may change face halfway: a bold name followed by a regular comma. */
function toWords(spans: Span[], size: number, foldText: Fold): Word[] {
  const words: Word[] = [];
  let pieces: Span[] = [];

  const flush = () => {
    if (pieces.length > 0) words.push({ pieces, width: wordWidth(pieces, size) });
    pieces = [];
  };

  for (const span of spans) {
    let text = "";
    const close = () => {
      if (text) pieces.push({ text, font: span.font });
      text = "";
    };
    // White space is settled before folding: a line break is a place to
    // break, not a character the fonts lack.
    for (const char of foldText(span.text.replace(/\s+/g, " "))) {
      if (char === " ") {
        close();
        flush();
      } else {
        text += char;
      }
    }
    close();
  }
  flush();
  return words;
}

/** Breaks a word wider than the column into chunks that fit, face by face. */
function breakWord(word: Word, size: number, width: number): Word[] {
  const chunks: Word[] = [];
  let pieces: Span[] = [];
  let used = 0;

  for (const piece of word.pieces) {
    let text = "";
    for (const char of piece.text) {
      const advance = measure(char, piece.font, size);
      if (used + advance > width && used > 0) {
        if (text) pieces.push({ text, font: piece.font });
        chunks.push({ pieces, width: used });
        pieces = [];
        text = "";
        used = 0;
      }
      text += char;
      used += advance;
    }
    if (text) pieces.push({ text, font: piece.font });
  }
  if (pieces.length > 0) chunks.push({ pieces, width: used });
  return chunks;
}

function toLine(words: Word[], size: number, stretch: boolean): WrappedLine {
  const runs: Span[] = [];
  words.forEach((word, index) => {
    for (const piece of word.pieces) {
      const last = runs[runs.length - 1];
      if (last && last.font === piece.font) last.text += piece.text;
      else runs.push({ text: piece.text, font: piece.font });
    }
    // The space belongs to the run before it, so one string per face is drawn.
    if (index < words.length - 1) runs[runs.length - 1].text += " ";
  });
  return {
    runs,
    width: runs.reduce((sum, run) => sum + measure(run.text, run.font, size), 0),
    spaces: Math.max(0, words.length - 1),
    stretch,
  };
}

/** Sets `spans` in lines no wider than `width`. An empty paragraph yields no line. */
export function wrapSpans(spans: Span[], size: number, width: number, foldText: Fold = foldToWinAnsi): WrappedLine[] {
  const words = toWords(spans, size, foldText).flatMap((word) =>
    word.width > width ? breakWord(word, size, width) : [word],
  );
  const lines: WrappedLine[] = [];
  let current: Word[] = [];
  let used = 0;

  for (const word of words) {
    const last = current[current.length - 1]?.pieces.at(-1);
    const space = last ? measure(" ", last.font, size) : 0;
    if (current.length > 0 && used + space + word.width > width) {
      lines.push(toLine(current, size, true));
      current = [word];
      used = word.width;
    } else {
      current.push(word);
      used += space + word.width;
    }
  }
  if (current.length > 0) lines.push(toLine(current, size, false));
  return lines;
}

// ---------------------------------------------------------------------------
// Page cursor
// ---------------------------------------------------------------------------

export type LayoutOptions = {
  margin: Margins;
  /** Line height of text() and item(), and of lines() when it is given none. */
  leading: number;
  /** Hanging indent of item(), wide enough for its label. */
  itemIndent: number;
  /** How text() and item() fold what the fonts cannot encode. */
  fold: Fold;
};

/**
 * A justified line is stretched at most this much per space, in font sizes.
 * Generous, because without hyphenation a long word at the start of the next
 * line leaves a loose one and a ragged line among justified ones reads as a
 * mistake; beyond it (one unbreakable run of characters) the line stays ragged.
 */
const MAX_STRETCH = 0.9;

/** Cursor over a growing document, adding pages as the content needs them. */
export class Layout {
  private page: PDFPage;
  private y: number;
  readonly contentWidth: number;

  constructor(
    private doc: PDFDocument,
    private options: LayoutOptions,
  ) {
    this.contentWidth = A4.width - options.margin.left - options.margin.right;
    this.page = doc.addPage([A4.width, A4.height]);
    this.y = A4.height - options.margin.top;
  }

  private ensure(height: number) {
    if (this.y - height >= this.options.margin.bottom) return;
    this.newPage();
  }

  /** Continues on a fresh page. */
  newPage() {
    this.page = this.doc.addPage([A4.width, A4.height]);
    this.y = A4.height - this.options.margin.top;
  }

  /** Where the next line goes: for drawing a mark beside it. Call reserve() first so the page is settled. */
  get cursor(): { page: PDFPage; y: number } {
    return { page: this.page, y: this.y };
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
    options: { indent?: number; color?: Color; align?: "left" | "center" } = {},
  ) {
    const { margin, leading, fold: foldText } = this.options;
    const indent = options.indent ?? 0;
    const width = this.contentWidth - indent;
    for (const line of wrap(content, font, size, width, foldText)) {
      this.ensure(leading);
      const lineWidth = font.widthOfTextAtSize(line, size);
      const x =
        options.align === "center"
          ? margin.left + (this.contentWidth - lineWidth) / 2
          : margin.left + indent;
      this.page.drawText(line, { x, y: this.y, size, font, color: options.color ?? INK });
      this.y -= leading;
    }
  }

  /** A numbered or lettered clause: the label sits in the margin, the text hangs indented. */
  item(label: string, content: string, font: PDFFont, size: number, color: Color = INK) {
    const { margin, leading, itemIndent, fold: foldText } = this.options;
    const lines = wrap(content, font, size, this.contentWidth - itemIndent, foldText);
    lines.forEach((line, i) => {
      this.ensure(leading);
      if (i === 0) {
        this.page.drawText(foldText(label), { x: margin.left, y: this.y, size, font, color });
      }
      this.page.drawText(line, { x: margin.left + itemIndent, y: this.y, size, font, color });
      this.y -= leading;
    });
  }

  rule(width: number) {
    this.ensure(24);
    this.page.drawLine({
      start: { x: this.options.margin.left, y: this.y },
      end: { x: this.options.margin.left + width, y: this.y },
      thickness: 0.75,
      color: INK_SOFT,
    });
    this.y -= this.options.leading;
  }

  /**
   * Draws lines set by wrapSpans(). `indent` moves the column in from the
   * left margin (wrap to `contentWidth - indent`); `label` is drawn once, on
   * the first line, at `label.x` from the margin: the "1." or "a)" a hanging
   * paragraph hangs from.
   */
  lines(
    lines: WrappedLine[],
    size: number,
    options: {
      indent?: number;
      align?: "left" | "center" | "justify";
      color?: Color;
      leading?: number;
      label?: { text: string; font: PDFFont; x: number };
    } = {},
  ) {
    const { margin } = this.options;
    const indent = options.indent ?? 0;
    const leading = options.leading ?? this.options.leading;
    const color = options.color ?? INK;
    const width = this.contentWidth - indent;

    lines.forEach((line, index) => {
      this.ensure(leading);
      if (index === 0 && options.label) {
        const { text, font, x } = options.label;
        this.page.drawText(this.options.fold(text), { x: margin.left + x, y: this.y, size, font, color });
      }

      let x = margin.left + indent;
      if (options.align === "center") x += (width - line.width) / 2;

      let extra = 0;
      if (options.align === "justify" && line.stretch && line.spaces > 0) {
        const wanted = (width - line.width) / line.spaces;
        if (wanted > 0 && wanted <= size * MAX_STRETCH) extra = wanted;
      }

      // Word spacing is part of the graphics state, so it is set around the
      // line and restored after it; every run inside inherits it.
      if (extra > 0) this.page.pushOperators(pushGraphicsState(), setWordSpacing(extra));
      for (const run of line.runs) {
        this.page.drawText(run.text, { x, y: this.y, size, font: run.font, color });
        x += measure(run.text, run.font, size) + extra * (run.text.split(" ").length - 1);
      }
      if (extra > 0) this.page.pushOperators(popGraphicsState());

      this.y -= leading;
    });
  }
}
