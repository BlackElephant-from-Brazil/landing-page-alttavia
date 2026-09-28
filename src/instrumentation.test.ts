import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * src/instrumentation.ts: onRequestError hands a server error to
 * src/lib/ops/request-error.ts in the Node.js runtime only, and never
 * throws, whatever that module does.
 */

const { reportRequestError } = vi.hoisted(() => ({ reportRequestError: vi.fn() }));

vi.mock("@/lib/ops/request-error", () => ({ reportRequestError }));

import { onRequestError } from "./instrumentation";

const REQUEST = { path: "/api/checkout?x=1", method: "POST", headers: {} };
const CONTEXT = {
  routerKind: "App Router" as const,
  routePath: "/api/checkout",
  routeType: "route" as const,
  revalidateReason: undefined,
};

let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  reportRequestError.mockReset().mockResolvedValue(undefined);
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  errorLog.mockRestore();
});

describe("onRequestError", () => {
  it("reports in the Node.js runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    const error = new Error("boom");

    await onRequestError(error, REQUEST, CONTEXT);

    expect(reportRequestError).toHaveBeenCalledWith(error, REQUEST, CONTEXT);
  });

  it("does nothing in the edge runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");

    await onRequestError(new Error("boom"), REQUEST, CONTEXT);

    expect(reportRequestError).not.toHaveBeenCalled();
  });

  it("never throws when the report rejects or throws", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    reportRequestError.mockRejectedValue(new Error("rejected"));
    await expect(onRequestError(new Error("boom"), REQUEST, CONTEXT)).resolves.toBeUndefined();

    reportRequestError.mockImplementation(() => {
      throw new Error("thrown");
    });
    await expect(onRequestError(new Error("boom"), REQUEST, CONTEXT)).resolves.toBeUndefined();
    expect(errorLog).toHaveBeenCalledTimes(2);
  });

  it("never throws when the reporting module cannot load", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.resetModules();
    vi.doMock("@/lib/ops/request-error", () => {
      throw new Error("module could not load");
    });
    const fresh = await import("./instrumentation");

    await expect(fresh.onRequestError(new Error("boom"), REQUEST, CONTEXT)).resolves.toBeUndefined();
    expect(errorLog).toHaveBeenCalledTimes(1);
    vi.doUnmock("@/lib/ops/request-error");
  });
});
