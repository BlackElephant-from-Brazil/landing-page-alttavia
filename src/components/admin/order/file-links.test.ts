import { describe, expect, it } from "vitest";

import { adminDocumentHref, canShowInline } from "./file-links";

describe("canShowInline", () => {
  it("is true for a PDF and for any image", () => {
    expect(canShowInline("application/pdf")).toBe(true);
    expect(canShowInline("image/jpeg")).toBe(true);
    expect(canShowInline("image/png")).toBe(true);
    expect(canShowInline("image/webp")).toBe(true);
  });

  it("reads a type with parameters and any case", () => {
    expect(canShowInline("Application/PDF; charset=binary")).toBe(true);
    expect(canShowInline(" IMAGE/JPEG ")).toBe(true);
  });

  it("is false for a Word file and for nothing at all", () => {
    expect(canShowInline("application/msword")).toBe(false);
    expect(
      canShowInline("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ).toBe(false);
    expect(canShowInline(null)).toBe(false);
    expect(canShowInline("")).toBe(false);
  });
});

describe("adminDocumentHref", () => {
  const id = "11111111-1111-4111-8111-111111111111";

  it("asks for the file itself to view and for a download with the flag", () => {
    expect(adminDocumentHref(id, "view")).toBe(`/api/admin/documents/${id}`);
    expect(adminDocumentHref(id, "download")).toBe(`/api/admin/documents/${id}?download=1`);
  });
});
