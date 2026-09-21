import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { asciiLetters, foldToPlain, foldToWinAnsi, transliterate, unprintable } from "./characters";

/** A character by code point, so the invisible ones under test are visible in the source. */
function ch(code: number): string {
  return String.fromCodePoint(code);
}

/** Names as a client may type them, and how every document must spell them. */
const SAMPLES: [language: string, typed: string, printed: string][] = [
  ["Polish", "Łukasz Żółć", "Lukasz Zolc"],
  ["Czech", "Jiří Dvořák Růžička", "Jiri Dvorak Ruzicka"],
  ["Turkish", "İbrahim Şahin Çağlar Işık", "Ibrahim Sahin Caglar Isik"],
  ["Romanian", "Ștefan Țăran Brâncuși", "Stefan Taran Brancusi"],
  ["Vietnamese", "Nguyễn Thị Đặng Hồng", "Nguyen Thi Dang Hong"],
];

describe("transliterate", () => {
  it.each(SAMPLES)("spells a %s name in plain letters throughout, never half accented", (_language, typed, printed) => {
    expect(transliterate(typed)).toBe(printed);
    // Typed with combining accents, it reads the same.
    expect(transliterate(typed.normalize("NFD"))).toBe(printed);
    // Nothing is left for the word wrap to fold, in either kind of document.
    expect(foldToPlain(transliterate(typed))).toBe(printed);
    expect(foldToWinAnsi(transliterate(typed))).toBe(printed);
  });

  it("shows what folding letter by letter did, which is why the whole value is folded", () => {
    // WinAnsi happens to hold the o with acute and not the other three letters.
    expect(foldToWinAnsi("Łukasz Żółć")).toBe("Lukasz Zólc");
    expect(transliterate("Łukasz Żółć")).toBe("Lukasz Zolc");
    // The z with caron is in WinAnsi, the u with ring and the c with caron are not.
    expect(foldToWinAnsi("Růžička")).toBe("Ružicka");
    expect(transliterate("Růžička")).toBe("Ruzicka");
  });

  it("keeps a value the fonts can spell exactly as typed, accents included", () => {
    for (const value of [
      "José António Conceição",
      "Müller-Lüdenscheidt",
      "Søren Åse Æbelø",
      "François d’Haène",
      "Straße 12, 2º esq., 1050-016 Lisboa",
      "Jane Alice Doe",
      "X1234567",
      "",
    ]) {
      expect(transliterate(value)).toBe(value.normalize("NFC"));
    }
  });

  it("composes a name typed with combining accents, so a deed and a contract read the same", () => {
    const typed = "José António".normalize("NFD");
    expect(typed).not.toBe("José António".normalize("NFC"));
    expect(transliterate(typed)).toBe("José António".normalize("NFC"));
  });

  it("folds the whole value, the letters WinAnsi holds too, once one letter is outside it", () => {
    expect(transliterate("José Łukasz")).toBe("Jose Lukasz");
    expect(transliterate("ul. Żółkiewskiego 5/7, 31-539 Kraków")).toBe("ul. Zolkiewskiego 5/7, 31-539 Krakow");
    expect(transliterate("Großstraße, Łódź")).toBe("Grossstrasse, Lodz");
  });

  it("leaves digits, punctuation and what has no plain spelling where they are", () => {
    expect(transliterate("Łódź, 2º andar — “B”")).toBe("Lodz, 2º andar — “B”");
    expect(transliterate("Łukasz 王")).toBe("Lukasz 王");
  });
});

describe("asciiLetters", () => {
  it("always folds, whatever WinAnsi holds: for file names", () => {
    expect(asciiLetters("José María O'Connor-Ávila")).toBe("Jose Maria O'Connor-Avila");
    expect(asciiLetters("Søren Æbelø Straße")).toBe("Soren AEbelo Strasse");
    expect(asciiLetters("Nguyễn Văn Łukasz")).toBe("Nguyen Van Lukasz");
    expect(asciiLetters("王小明 123")).toBe("王小明 123");
  });
});

describe("unprintable", () => {
  it("is empty for anything written in Latin letters, accented or not", () => {
    for (const [, typed] of SAMPLES) expect(unprintable(typed), typed).toEqual([]);
    for (const value of [
      "José António Conceição",
      "Jane Alice Doe",
      "Hawaiʻi",
      "O’Connor, “Apt. 4” — 2º esq. … €",
      "1200 West 6th Street, Apartment 14B, Austin, TX 78703",
      "",
    ]) {
      expect(unprintable(value), value).toEqual([]);
    }
  });

  it("names the characters that would print as question marks, each once, in order", () => {
    expect(unprintable("Иван Иванов")).toEqual(["И", "в", "а", "н", "о"]);
    expect(unprintable("王小明")).toEqual(["王", "小", "明"]);
    expect(unprintable("محمد")).toEqual(["م", "ح", "د"]);
    expect(unprintable("Jane 🙂 Doe")).toEqual(["🙂"]);
    expect(unprintable("Łukasz 王")).toEqual(["王"]);
  });

  it("does not count a question mark that was typed", () => {
    expect(unprintable("Why? Street")).toEqual([]);
    expect(unprintable("?")).toEqual([]);
  });
});

describe("the two folds", () => {
  const HYPHEN = ch(0x2010);
  const NON_BREAKING_HYPHEN = ch(0x2011);

  it("agree on the hyphens and the spaces a word processor leaves behind", () => {
    // These two printed "-" in a contract and "?" in a deed before the tables were made to agree.
    for (const hyphen of [HYPHEN, NON_BREAKING_HYPHEN, ch(0x2212)]) {
      expect(foldToPlain(`Anne${hyphen}Marie`)).toBe("Anne-Marie");
      expect(foldToWinAnsi(`Anne${hyphen}Marie`)).toBe("Anne-Marie");
    }
    for (const space of [0x00a0, 0x2002, 0x2003, 0x2007, 0x2009, 0x200a, 0x202f, 0x205f, 0x3000]) {
      expect(foldToPlain(`New${ch(space)}York`), space.toString(16)).toBe("New York");
      expect(foldToWinAnsi(`New${ch(space)}York`), space.toString(16)).toBe("New York");
    }
    for (const invisible of [0x00ad, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2060, 0xfeff]) {
      expect(foldToPlain(`Lis${ch(invisible)}boa`), invisible.toString(16)).toBe("Lisboa");
      expect(foldToWinAnsi(`Lis${ch(invisible)}boa`), invisible.toString(16)).toBe("Lisboa");
    }
  });

  it("print a question mark for exactly the same characters", () => {
    // Every character of the Basic Multilingual Plane outside the surrogates, one by one.
    const disagree: string[] = [];
    for (let code = 0x20; code <= 0xffff; code++) {
      if (code >= 0xd800 && code <= 0xdfff) continue;
      const char = ch(code);
      if (char === "?") continue;
      // `includes`, not equality: the contracts' fold composes first, and a few characters compose into two.
      if (foldToPlain(char).includes("?") !== foldToWinAnsi(char).includes("?")) disagree.push(code.toString(16));
    }
    expect(disagree).toEqual([]);
  });

  it("still differ where they should: a deed prints plain quotes and dashes, a contract keeps them", () => {
    expect(foldToPlain("“Client’s” — NIF…")).toBe("\"Client's\" - NIF...");
    expect(foldToWinAnsi("“Client’s” — NIF…")).toBe("“Client’s” — NIF…");
  });
});

describe("characters.ts", () => {
  it("imports nothing, so a client component can use it without bundling pdf-lib", () => {
    const source = readFileSync(fileURLToPath(new URL("./characters.ts", import.meta.url)), "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/\brequire\(/);
  });
});
