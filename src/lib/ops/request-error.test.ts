import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Node.js side of onRequestError: what the alert for a request error
 * says, that it never carries the query string, the headers or an email
 * address, that it goes to the platform's waitUntil when there is one, and
 * that nothing here throws. sendOpsAlert is a spy.
 */

const { sendOpsAlert } = vi.hoisted(() => ({ sendOpsAlert: vi.fn() }));

vi.mock("./alerts", () => ({ sendOpsAlert }));

import { platformWaitUntil, reportRequestError, requestErrorAlert } from "./request-error";

const REQUEST_CONTEXT = Symbol.for("@next/request-context");

const REQUEST = {
  path: "/en/dashboard/orders/33333333-3333-4333-8333-333333333333?session_id=cs_test_1&email=ana@example.com",
  method: "get",
  headers: { cookie: "sb-access-token=secret", authorization: "Bearer secret" },
};

const CONTEXT = {
  routerKind: "App Router" as const,
  routePath: "/[locale]/dashboard/orders/[id]",
  routeType: "render" as const,
  renderSource: "react-server-components" as const,
  revalidateReason: undefined,
};

function boom(): Error {
  return Object.assign(new Error("Could not load the order for ana@example.com"), { digest: "2345678901" });
}

let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  sendOpsAlert.mockReset().mockResolvedValue("sent");
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  delete (globalThis as Record<symbol, unknown>)[REQUEST_CONTEXT];
  errorLog.mockRestore();
});

describe("requestErrorAlert", () => {
  it("keys by route type and route path, and lists the facts without the query string", () => {
    const alert = requestErrorAlert(boom(), REQUEST, CONTEXT);

    expect(alert.kind).toBe("server_error");
    expect(alert.key).toBe("render:/[locale]/dashboard/orders/[id]");
    expect(alert.subject).toBe("Server error: render /[locale]/dashboard/orders/[id]");
    expect(alert.facts).toEqual([
      { label: "Method", value: "GET" },
      { label: "Path", value: "/en/dashboard/orders/33333333-3333-4333-8333-333333333333" },
      { label: "Route", value: "/[locale]/dashboard/orders/[id]" },
      { label: "Route type", value: "render" },
      { label: "Error", value: "Error: Could not load the order for [email]" },
      { label: "Digest", value: "2345678901" },
    ]);
    expect(alert.stack?.split("\n").length).toBeLessThanOrEqual(5);
  });

  it("never carries the headers", () => {
    const serialised = JSON.stringify(requestErrorAlert(boom(), REQUEST, CONTEXT));

    expect(serialised).not.toContain("sb-access-token");
    expect(serialised).not.toContain("Bearer");
    expect(serialised).not.toContain("session_id");
    expect(serialised).not.toContain("ana@example.com");
  });

  it("reads missing or odd arguments without throwing", () => {
    const alert = requestErrorAlert("a string", undefined, undefined);

    expect(alert.key).toBe("unknown:unknown");
    expect(alert.facts).toContainEqual({ label: "Error", value: "Thrown string: a string" });
    expect(alert.facts).toContainEqual({ label: "Digest", value: "None" });
  });
});

describe("platformWaitUntil", () => {
  it("finds the waitUntil Next.js reads for after(), and nothing when there is none", () => {
    expect(platformWaitUntil()).toBeNull();

    const waitUntil = vi.fn();
    (globalThis as Record<symbol, unknown>)[REQUEST_CONTEXT] = { get: () => ({ waitUntil }) };
    const found = platformWaitUntil();
    const task = Promise.resolve();
    found?.(task);

    expect(waitUntil).toHaveBeenCalledWith(task);
  });

  it("answers null when the accessor throws", () => {
    (globalThis as Record<symbol, unknown>)[REQUEST_CONTEXT] = {
      get: () => {
        throw new Error("outside a request");
      },
    };

    expect(platformWaitUntil()).toBeNull();
  });
});

describe("reportRequestError", () => {
  it("awaits the alert when the platform has no waitUntil", async () => {
    await reportRequestError(boom(), REQUEST, CONTEXT);

    expect(sendOpsAlert).toHaveBeenCalledTimes(1);
    expect(sendOpsAlert.mock.calls[0][0]).toMatchObject({ kind: "server_error", key: "render:/[locale]/dashboard/orders/[id]" });
  });

  it("hands the alert to waitUntil and returns at once when there is one", async () => {
    const waitUntil = vi.fn();
    (globalThis as Record<symbol, unknown>)[REQUEST_CONTEXT] = { get: () => ({ waitUntil }) };
    sendOpsAlert.mockReturnValue(new Promise(() => {}));

    await reportRequestError(boom(), REQUEST, CONTEXT);

    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("never throws, even when the alert does", async () => {
    sendOpsAlert.mockImplementation(() => {
      throw new Error("sender exploded for ana@example.com");
    });

    await expect(reportRequestError(boom(), REQUEST, CONTEXT)).resolves.toBeUndefined();
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(String(errorLog.mock.calls[0][0])).not.toContain("ana@example.com");
  });
});
