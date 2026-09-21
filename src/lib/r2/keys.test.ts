import { describe, expect, it } from "vitest";

import {
  acceptedTypesMessage,
  buildStorageKey,
  contentDisposition,
  extensionFor,
  formatBytes,
  MAX_FILE_NAME_LENGTH,
  mimeForFileName,
  sanitizeFileName,
  sizeLimitMessage,
} from "./keys";

const ORDER = "8a1d2b3c-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("buildStorageKey", () => {
  it("follows orders/{order}/{doc}/{applicant}/{uuid}.{ext}", () => {
    const key = buildStorageKey(ORDER, "passport", 1, "pdf");
    const parts = key.split("/");
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe("orders");
    expect(parts[1]).toBe(ORDER);
    expect(parts[2]).toBe("passport");
    expect(parts[3]).toBe("1");
    const [name, ext, ...rest] = parts[4].split(".");
    expect(name).toMatch(UUID);
    expect(ext).toBe("pdf");
    expect(rest).toHaveLength(0);
  });

  it("gives every upload its own name", () => {
    const a = buildStorageKey(ORDER, "passport", 0, "jpg");
    const b = buildStorageKey(ORDER, "passport", 0, "jpg");
    expect(a).not.toBe(b);
  });

  it("refuses segments that could leave the order's folder", () => {
    expect(() => buildStorageKey("../x", "passport", 0, "pdf")).toThrow();
    expect(() => buildStorageKey(ORDER, "pass/port", 0, "pdf")).toThrow();
    expect(() => buildStorageKey(ORDER, "passport", 2 as unknown as 0, "pdf")).toThrow();
    expect(() => buildStorageKey(ORDER, "passport", 0, "p.df")).toThrow();
  });
});

describe("extensionFor", () => {
  it("maps each accepted mime type to its extension", () => {
    expect(extensionFor("application/pdf")).toBe("pdf");
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/png")).toBe("png");
    expect(extensionFor("image/webp")).toBe("webp");
    expect(extensionFor("application/msword")).toBe("doc");
    expect(
      extensionFor("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ).toBe("docx");
  });

  it("is case and whitespace tolerant", () => {
    expect(extensionFor(" Image/JPEG ")).toBe("jpg");
  });

  it("rejects anything else with null", () => {
    expect(extensionFor("text/html")).toBeNull();
    expect(extensionFor("application/octet-stream")).toBeNull();
    expect(extensionFor("image/svg+xml")).toBeNull();
    expect(extensionFor("")).toBeNull();
  });
});

describe("mimeForFileName", () => {
  it("recovers the type from the extension when the browser reports none", () => {
    expect(mimeForFileName("contract.DOCX")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(mimeForFileName("scan.jpeg")).toBe("image/jpeg");
    expect(mimeForFileName("notes")).toBeNull();
    expect(mimeForFileName("page.html")).toBeNull();
  });
});

describe("sanitizeFileName", () => {
  it("strips path separators and control characters", () => {
    expect(sanitizeFileName("..\\..\\etc/passwd.pdf")).toBe("....etcpasswd.pdf");
    expect(sanitizeFileName("a\u0000b\u001fc.png")).toBe("abc.png");
    expect(sanitizeFileName("  my   scan .pdf ")).toBe("my scan .pdf");
  });

  it("keeps digits and capitals", () => {
    expect(sanitizeFileName("Passport 2026 A1.PDF")).toBe("Passport 2026 A1.PDF");
  });

  it("falls back to a name when nothing is left", () => {
    expect(sanitizeFileName("///")).toBe("file");
  });

  it("cuts to the limit and keeps the extension", () => {
    const long = `${"a".repeat(200)}.pdf`;
    const out = sanitizeFileName(long);
    expect(out.length).toBe(MAX_FILE_NAME_LENGTH);
    expect(out.endsWith(".pdf")).toBe(true);
  });
});

describe("contentDisposition", () => {
  it("names the file twice: plain ASCII for every client, and as it really is", () => {
    expect(contentDisposition("inline", "service-agreement-nif-jane-doe.pdf")).toBe(
      "inline; filename=\"service-agreement-nif-jane-doe.pdf\"; filename*=UTF-8''service-agreement-nif-jane-doe.pdf",
    );
    expect(contentDisposition("attachment", "Passaporte João.pdf")).toBe(
      "attachment; filename=\"Passaporte Joo.pdf\"; filename*=UTF-8''Passaporte%20Jo%C3%A3o.pdf",
    );
  });

  it("lets nothing typed into a name break out of the header", () => {
    const value = contentDisposition("inline", `a"b\\c${String.fromCharCode(13, 10)}X-Evil: 1.pdf`);
    expect(value).toBe("inline; filename=\"abcX-Evil: 1.pdf\"; filename*=UTF-8''a%22b%5Cc%0D%0AX-Evil%3A%201.pdf");
    expect(value).not.toMatch(/[\r\n]/);
  });

  it("falls back to a name when nothing plain is left", () => {
    expect(contentDisposition("inline", "文件")).toBe("inline; filename=\"file\"; filename*=UTF-8''%E6%96%87%E4%BB%B6");
  });
});

describe("messages", () => {
  it("lists the accepted types in words", () => {
    expect(acceptedTypesMessage(["application/pdf", "image/jpeg", "image/png"])).toBe(
      "This file type is not accepted. Use PDF, JPG or PNG.",
    );
    expect(acceptedTypesMessage(["application/pdf"])).toBe("This file type is not accepted. Use PDF.");
  });

  it("states the size limit in whole units", () => {
    expect(formatBytes(10485760)).toBe("10 MB");
    expect(formatBytes(512000)).toBe("500 KB");
    expect(sizeLimitMessage(10485760)).toBe("This file is too large. The limit is 10 MB.");
  });
});
