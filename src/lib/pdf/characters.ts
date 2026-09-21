/**
 * Which characters the PDFs can print, and what becomes of the rest. Shared
 * by the powers of attorney and the service contracts through
 * src/lib/pdf/layout.ts, and by the forms' validation, which must know
 * before anything is saved whether a name can be printed at all.
 *
 * No pdf-lib, no node, nothing server only: this module is imported by client
 * components (through src/lib/orders/applicant-rules.ts), so it has to stay
 * plain data and string functions.
 *
 * The standard PDF fonts encode WinAnsi (Windows-1252), which covers
 * Portuguese, Spanish, French and German but not every character a word
 * processor or a passport may hold. Three things happen to what it lacks:
 *
 *   foldToPlain / foldToWinAnsi   character by character, inside the word
 *                                 wrap, for any text: a letter is folded to
 *                                 its base letter, what cannot be folded
 *                                 prints as "?" rather than throwing halfway
 *                                 through a legal document.
 *   transliterate(value)          for a VALUE typed by a client (a name, an
 *                                 address): when it holds any letter WinAnsi
 *                                 lacks, the whole value goes to plain ASCII
 *                                 letters, the way the machine readable line
 *                                 of a passport spells it. Folding letter by
 *                                 letter would print "Lukasz Zólc" for
 *                                 "Łukasz Żółć": the letters WinAnsi happens
 *                                 to hold would keep their accent and the
 *                                 rest lose it.
 *   unprintable(text)             the characters that would still print as
 *                                 "?" after all that (Cyrillic, Chinese,
 *                                 Arabic, an emoji), so a form can refuse
 *                                 them instead of printing question marks.
 *
 * Every table below is written with escapes on purpose: half of these
 * characters are invisible in an editor.
 */

/** Spaces a word processor or a phone keyboard leaves behind: each prints as a plain space. */
const SPACES = [
  "\u00A0", // no-break space
  "\u2000", "\u2001", "\u2002", "\u2003", "\u2004", "\u2005", "\u2006", // en and em quads and spaces
  "\u2007", "\u2008", "\u2009", "\u200A", // figure, punctuation, thin and hair space
  "\u202F", // narrow no-break space
  "\u205F", // medium mathematical space
  "\u3000", // ideographic space
];

/** Characters that take no room: dropped. */
const INVISIBLE = [
  "\u00AD", // soft hyphen
  "\u200B", "\u200C", "\u200D", // zero width space, non-joiner, joiner
  "\u200E", "\u200F", // left-to-right and right-to-left marks
  "\u2060", // word joiner
  "\uFEFF", // byte order mark
];

/**
 * What WinAnsi lacks and has an obvious plain form. Both folds use it, so
 * a deed and a contract agree on which characters print and which do not.
 */
const TO_WIN_ANSI: Record<string, string> = {
  "\u2032": "'", // prime
  "\u2033": '"', // double prime
  "\u2212": "-", // minus sign
  "\u2010": "-", // hyphen
  "\u2011": "-", // non-breaking hyphen
  ...Object.fromEntries(SPACES.map((char) => [char, " "])),
  ...Object.fromEntries(INVISIBLE.map((char) => [char, ""])),
};

/**
 * The deeds' table: everything above, plus the typographic quotes, dashes,
 * ellipsis and bullet, which WinAnsi can encode but a deed prints in their
 * plain forms, as it always has.
 */
const TO_PLAIN: Record<string, string> = {
  ...TO_WIN_ANSI,
  "\u2018": "'", "\u2019": "'", "\u201A": "'", // single curly quotes
  "\u201C": '"', "\u201D": '"', "\u201E": '"', // double curly quotes
  "\u2013": "-", "\u2014": "-", // en and em dash
  "\u2026": "...", // ellipsis
  "\u2022": "-", // bullet
};

/** Letters NFD cannot decompose, mapped to their usual plain spelling. */
const PLAIN_LETTERS: Record<string, string> = {
  "\u0141": "L", "\u0142": "l", // L with stroke (Polish)
  "\u0110": "D", "\u0111": "d", // D with stroke (Vietnamese, Croatian)
  "\u0126": "H", "\u0127": "h", // H with stroke (Maltese)
  "\u0131": "i", // dotless i (Turkish)
  "\u0166": "T", "\u0167": "t", // T with stroke
  "\u013F": "L", "\u0140": "l", // L with middle dot
  "\u00D8": "O", "\u00F8": "o", // O with stroke
  "\u0152": "OE", "\u0153": "oe",
  "\u00C6": "AE", "\u00E6": "ae",
  "\u00DF": "ss", // sharp s
  "\u00DE": "Th", "\u00FE": "th", // thorn
  "\u00D0": "D", "\u00F0": "d", // eth
  "\u014A": "N", "\u014B": "n", // eng
  "\u018F": "A", "\u0259": "a", // schwa (Azerbaijani)
  "\u0132": "IJ", "\u0133": "ij",
  "\u02BB": "'", "\u02BC": "'", // the okina and the modifier apostrophe, letters to Unicode
};

/** Printable ASCII, Latin-1 and the WinAnsi extras the standard fonts know. */
const WIN_ANSI =
  /^[\x20-\x7E\xA0-\xFF\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]$/;

const ASCII = /^[\x20-\x7E]$/;

// Built from strings: a regular expression literal with \p{...} needs a newer
// compile target than this project's.
const MARKS = new RegExp("\\p{M}", "gu");
const LETTER_OR_MARK = new RegExp("^[\\p{L}\\p{M}]$", "u");

// ---------------------------------------------------------------------------
// Character by character (inside the word wrap)
// ---------------------------------------------------------------------------

function foldCharacter(char: string): string {
  if (WIN_ANSI.test(char)) return char;
  const plain = PLAIN_LETTERS[char];
  if (plain !== undefined) return plain;
  const decomposed = char.normalize("NFD").replace(MARKS, "");
  if (decomposed !== char && decomposed.length > 0 && WIN_ANSI.test(decomposed)) return decomposed;
  return "?";
}

function fold(text: string, table: Record<string, string>): string {
  let out = "";
  for (const char of text) {
    const mapped = table[char];
    out += mapped !== undefined ? mapped : foldCharacter(char);
  }
  return out;
}

/** The deeds' folding: typographic quotes and dashes go to their plain forms too. */
export function foldToPlain(text: string): string {
  return fold(text, TO_PLAIN);
}

/**
 * The contracts' folding: whatever WinAnsi can encode is kept as written,
 * the rest is folded as in the deeds. Composed first, so a name typed with
 * combining accents keeps them.
 */
export function foldToWinAnsi(text: string): string {
  return fold(text.normalize("NFC"), TO_WIN_ANSI);
}

export type Fold = (text: string) => string;

// ---------------------------------------------------------------------------
// A whole value (a name, a place, an address typed by a client)
// ---------------------------------------------------------------------------

/** The plain ASCII spelling of one letter or mark; null when it has none (Cyrillic, Arabic, Chinese). */
function asciiLetter(char: string): string | null {
  let out = "";
  for (const part of char.normalize("NFD").replace(MARKS, "")) {
    if (ASCII.test(part)) {
      out += part;
      continue;
    }
    const plain = PLAIN_LETTERS[part];
    if (plain === undefined) return null;
    out += plain;
  }
  return out;
}

/**
 * Every letter in its plain ASCII spelling, accents dropped: "Łukasz Żółć"
 * becomes "Lukasz Zolc", "Müller" becomes "Muller". Digits, punctuation and
 * letters that have no plain spelling are left as they are.
 */
export function asciiLetters(text: string): string {
  let out = "";
  for (const char of text.normalize("NFC")) {
    out += LETTER_OR_MARK.test(char) ? (asciiLetter(char) ?? char) : char;
  }
  return out;
}

/**
 * A client's value as the documents print it. A value WinAnsi can spell is
 * kept as typed, accents included ("José António"). A value holding any
 * letter WinAnsi lacks is spelled in plain ASCII letters throughout, so it
 * never prints half accented. Always composed (NFC), so a name typed with
 * combining accents reads the same in a deed and in a contract.
 */
export function transliterate(value: string): string {
  const composed = value.normalize("NFC");
  for (const char of composed) {
    if (LETTER_OR_MARK.test(char) && !WIN_ANSI.test(char)) return asciiLetters(composed);
  }
  return composed;
}

/**
 * The characters of `text` no document could print: what is still a "?"
 * after the value is transliterated and folded. Each once, in order of
 * appearance. A literal "?" is not one of them. Empty for anything written
 * in Latin letters, accented or not.
 */
export function unprintable(text: string): string[] {
  const found = new Set<string>();
  for (const char of transliterate(text)) {
    if (char === "?") continue;
    if (foldToPlain(char).includes("?") || foldToWinAnsi(char).includes("?")) found.add(char);
  }
  return [...found];
}
