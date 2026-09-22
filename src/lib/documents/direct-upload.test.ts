import { describe, expect, it } from "vitest";

import {
  DIRECT_INCOMPLETE,
  DIRECT_TOO_BIG,
  DIRECT_TYPE_MISMATCH,
  DIRECT_UPLOAD_MAX_BYTES,
  checkDirectUpload,
  contentLengthOf,
  directUploadLimit,
  normalizeContentType,
  requireDeclaredLength,
} from "./direct-upload";

const ROW = { expectedBytes: 1_200_000, expectedType: "image/png", maxBytes: 10_000_000 };

describe("directUploadLimit", () => {
  it("never lets a slot carry more than a request can", () => {
    expect(directUploadLimit(10_000_000)).toBe(DIRECT_UPLOAD_MAX_BYTES);
    expect(directUploadLimit(500_000)).toBe(500_000);
  });
});

describe("normalizeContentType", () => {
  it("keeps the type and drops the parameters", () => {
    expect(normalizeContentType("image/PNG; charset=binary")).toBe("image/png");
    expect(normalizeContentType("")).toBeNull();
    expect(normalizeContentType(null)).toBeNull();
  });
});

describe("checkDirectUpload", () => {
  it("accepts a body that matches the row", () => {
    expect(
      checkDirectUpload({ ...ROW, contentType: "image/png", contentLength: 1_200_000, receivedBytes: 1_200_000 }),
    ).toEqual({ ok: true });
  });

  it("accepts the headers before the body has been read", () => {
    expect(checkDirectUpload({ ...ROW, contentType: "image/png", contentLength: 1_200_000 })).toEqual({ ok: true });
  });

  it("refuses a file bigger than a request can carry", () => {
    expect(checkDirectUpload({ ...ROW, expectedBytes: 5_000_000 })).toEqual({
      ok: false,
      status: 413,
      error: DIRECT_TOO_BIG,
    });
  });

  it("refuses a body longer than the limit even when the row is small", () => {
    expect(checkDirectUpload({ ...ROW, contentLength: DIRECT_UPLOAD_MAX_BYTES + 1 })).toEqual({
      ok: false,
      status: 413,
      error: DIRECT_TOO_BIG,
    });
  });

  it("refuses a length that does not match the row", () => {
    expect(checkDirectUpload({ ...ROW, contentLength: 1_199_999 })).toEqual({
      ok: false,
      status: 422,
      error: DIRECT_INCOMPLETE,
    });
    expect(checkDirectUpload({ ...ROW, receivedBytes: 900_000 })).toEqual({
      ok: false,
      status: 422,
      error: DIRECT_INCOMPLETE,
    });
  });

  it("refuses a type that does not match the row and ignores a missing one", () => {
    expect(checkDirectUpload({ ...ROW, contentType: "application/pdf" })).toEqual({
      ok: false,
      status: 415,
      error: DIRECT_TYPE_MISMATCH,
    });
    expect(checkDirectUpload({ ...ROW, contentType: null })).toEqual({ ok: true });
  });

  it("refuses a row with no size to expect", () => {
    expect(checkDirectUpload({ ...ROW, expectedBytes: 0 })).toEqual({
      ok: false,
      status: 422,
      error: DIRECT_INCOMPLETE,
    });
  });
});

describe("requireDeclaredLength", () => {
  it("takes a declared length and refuses a request that declares none", () => {
    expect(requireDeclaredLength(2048)).toEqual({ ok: true, length: 2048 });
    expect(requireDeclaredLength(null)).toEqual({ ok: false, status: 411, error: DIRECT_INCOMPLETE });
    expect(requireDeclaredLength(0)).toEqual({ ok: false, status: 411, error: DIRECT_INCOMPLETE });
  });
});

describe("contentLengthOf", () => {
  it("reads the header or answers null", () => {
    const request = (value: string | null) => ({ headers: { get: () => value } });
    expect(contentLengthOf(request("2048"))).toBe(2048);
    expect(contentLengthOf(request(null))).toBeNull();
    expect(contentLengthOf(request("many"))).toBeNull();
    expect(contentLengthOf(request("-1"))).toBeNull();
  });
});
