import { describe, expect, it } from "vitest";

import { PRICE_CENTS } from "@/content/bank-nif";
import { euroAmount, euroWords } from "./words";

describe("euroWords", () => {
  it("spells whole euro amounts the British way, with and", () => {
    const samples: [number, string][] = [
      [0, "zero"],
      [1, "one"],
      [15, "fifteen"],
      [21, "twenty-one"],
      [99, "ninety-nine"],
      [100, "one hundred"],
      [101, "one hundred and one"],
      [149, "one hundred and forty-nine"],
      [399, "three hundred and ninety-nine"],
      [497, "four hundred and ninety-seven"],
      [597, "five hundred and ninety-seven"],
      [1000, "one thousand"],
      [1001, "one thousand and one"],
      [9999, "nine thousand nine hundred and ninety-nine"],
    ];
    for (const [euros, words] of samples) {
      expect(euroWords(euros * 100), String(euros)).toBe(words);
    }
  });

  it("covers the tens, the teens and the round numbers", () => {
    expect(euroWords(1000)).toBe("ten");
    expect(euroWords(1300)).toBe("thirteen");
    expect(euroWords(2000)).toBe("twenty");
    expect(euroWords(9000)).toBe("ninety");
    expect(euroWords(11000)).toBe("one hundred and ten");
    expect(euroWords(99900)).toBe("nine hundred and ninety-nine");
    expect(euroWords(110000)).toBe("one thousand one hundred");
    expect(euroWords(101000)).toBe("one thousand and ten");
    expect(euroWords(250000)).toBe("two thousand five hundred");
    expect(euroWords(1234500)).toBe("twelve thousand three hundred and forty-five");
    expect(euroWords(100000000)).toBe("one million");
    expect(euroWords(200005000)).toBe("two million and fifty");
  });

  it("reads cents as a decimal, so the model's own euros can follow", () => {
    // The models print "([FEE IN WORDS] euros)": the phrase must end where "euros" fits.
    expect(euroWords(14950)).toBe("one hundred and forty-nine point five zero");
    expect(euroWords(14905)).toBe("one hundred and forty-nine point zero five");
    expect(euroWords(99)).toBe("zero point nine nine");
    expect(euroWords(100010)).toBe("one thousand point one zero");
  });

  it("spells every price the landing sells", () => {
    expect(euroWords(PRICE_CENTS.nifOnly)).toBe("one hundred and forty-nine");
    expect(euroWords(PRICE_CENTS.bankOnly)).toBe("three hundred and ninety-nine");
    expect(euroWords(PRICE_CENTS.bundle)).toBe("four hundred and ninety-seven");
    expect(euroWords(PRICE_CENTS.couple)).toBe("five hundred and ninety-seven");
    expect(euroWords(PRICE_CENTS.renewal)).toBe("ninety-nine");
  });

  it("never throws on a number that is not a price", () => {
    expect(euroWords(Number.NaN)).toBe("zero");
    expect(euroWords(-500)).toBe("zero");
    expect(euroWords(14900.4)).toBe("one hundred and forty-nine");
    expect(euroWords(Number.POSITIVE_INFINITY)).toBe("zero");
  });
});

describe("euroAmount", () => {
  it("prints whole euros bare and cents with two digits", () => {
    expect(euroAmount(0)).toBe("0");
    expect(euroAmount(14900)).toBe("149");
    expect(euroAmount(14950)).toBe("149.50");
    expect(euroAmount(14905)).toBe("149.05");
    expect(euroAmount(99)).toBe("0.99");
  });

  it("uses no thousands separator, which would read as a decimal mark in Portugal", () => {
    expect(euroAmount(100000)).toBe("1000");
    expect(euroAmount(999900)).toBe("9999");
    expect(euroAmount(1234550)).toBe("12345.50");
  });

  it("never throws on a number that is not a price", () => {
    expect(euroAmount(Number.NaN)).toBe("0");
    expect(euroAmount(-1)).toBe("0");
    expect(euroAmount(14900.4)).toBe("149");
  });
});
