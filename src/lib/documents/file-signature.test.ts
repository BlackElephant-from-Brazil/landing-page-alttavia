import { describe, expect, it } from "vitest";

import { matchesDeclaredType, signedCopyFileName } from "./file-signature";

/**
 * The checks that decide whether a client's signed copy rides along as an
 * attachment to the team inbox, and under which name.
 */

const ORDER_ID = "33333333-3333-4333-8333-333333333333";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

describe("matchesDeclaredType", () => {
  it("knows a PDF, a JPG, a PNG and a WebP by their first bytes", () => {
    expect(matchesDeclaredType(text("%PDF-1.7\n..."), "application/pdf")).toBe(true);
    expect(matchesDeclaredType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16), "image/jpeg")).toBe(true);
    expect(matchesDeclaredType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0), "image/png")).toBe(true);
    expect(matchesDeclaredType(text("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "), "image/webp")).toBe(true);
  });

  it("reads the declared type in any case and with spaces around it", () => {
    expect(matchesDeclaredType(text("%PDF-1.4"), " Application/PDF ")).toBe(true);
  });

  it("refuses bytes that are something else than the type says", () => {
    expect(matchesDeclaredType(text("<html><script>alert(1)</script>"), "application/pdf")).toBe(false);
    expect(matchesDeclaredType(text("%PDF-1.7"), "image/png")).toBe(false);
    expect(matchesDeclaredType(bytes(0x4d, 0x5a, 0x90, 0), "image/jpeg")).toBe(false);
    expect(matchesDeclaredType(text("RIFF\u0000\u0000\u0000\u0000WAVE"), "image/webp")).toBe(false);
  });

  it("refuses a file too short to tell, and an empty one", () => {
    expect(matchesDeclaredType(text("%PD"), "application/pdf")).toBe(false);
    expect(matchesDeclaredType(new Uint8Array(0), "image/jpeg")).toBe(false);
  });

  it("never matches a type it does not know, a Word file included", () => {
    const zip = bytes(0x50, 0x4b, 0x03, 0x04, 0, 0);
    expect(matchesDeclaredType(zip, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(false);
    expect(matchesDeclaredType(text("<html>"), "text/html")).toBe(false);
  });
});

describe("signedCopyFileName", () => {
  it("names the copy after the order, with the extension of its type", () => {
    expect(signedCopyFileName(ORDER_ID, "application/pdf")).toBe(`signed-agreement-${ORDER_ID}.pdf`);
    expect(signedCopyFileName(ORDER_ID, "image/jpeg")).toBe(`signed-agreement-${ORDER_ID}.jpg`);
    expect(signedCopyFileName(ORDER_ID, "IMAGE/PNG")).toBe(`signed-agreement-${ORDER_ID}.png`);
  });

  it("gives no name to a type that is never attached, or to an id that is not a plain id", () => {
    expect(signedCopyFileName(ORDER_ID, "application/msword")).toBeNull();
    expect(signedCopyFileName(ORDER_ID, "text/html")).toBeNull();
    expect(signedCopyFileName("../x", "application/pdf")).toBeNull();
    expect(signedCopyFileName("", "application/pdf")).toBeNull();
  });
});
