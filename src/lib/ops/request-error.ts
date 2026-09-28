import type { Instrumentation } from "next";

import type { OpsAlertInput } from "./alerts";
import { cleanText, describeError, pathWithoutQuery } from "./format";

/**
 * The Node.js side of `onRequestError` in src/instrumentation.ts: turns a
 * server error Next.js caught in a page, a route handler, a server action or
 * the proxy into one operations alert (./alerts.ts).
 *
 * Keyed by route type and route path (the file route, "/[locale]/dashboard",
 * not the address a visitor typed), so a broken page sends one email per 30
 * minutes however many visitors hit it. The facts are the method, the path
 * without its query string, the route, the route type, the error's name and
 * message, its digest and the time in Lisbon (added by ./alerts.ts). Never
 * the headers Next.js hands over: they hold the session cookies.
 *
 * Next.js awaits `onRequestError` before it sends the error answer. So when
 * the platform offers a `waitUntil` (Netlify does, through the request
 * context Next.js itself reads for after(), see
 * node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md),
 * the alert is handed to it and the answer goes out at once. Without one
 * (next start, next dev) the alert is awaited, and sendOpsAlert gives up
 * waiting after five seconds.
 *
 * Never throws: whatever goes wrong here is one log line.
 */

type OnRequestError = Instrumentation.onRequestError;
type ErrorRequest = Parameters<OnRequestError>[1];
type ErrorContext = Parameters<OnRequestError>[2];

const REQUEST_CONTEXT = Symbol.for("@next/request-context");

type WaitUntil = (promise: Promise<unknown>) => void;

/** The platform's waitUntil for the current request, as Next.js finds it for after(); null when there is none. */
export function platformWaitUntil(): WaitUntil | null {
  try {
    const accessor = (globalThis as Record<symbol, unknown>)[REQUEST_CONTEXT] as
      | { get?: () => { waitUntil?: unknown } | undefined }
      | undefined;
    const context = typeof accessor?.get === "function" ? accessor.get() : undefined;
    const waitUntil = context?.waitUntil;
    if (typeof waitUntil !== "function") return null;
    return (promise) => {
      (waitUntil as WaitUntil).call(context, promise);
    };
  } catch {
    return null;
  }
}

/** The alert for one request error. Pure; reads every field defensively. */
export function requestErrorAlert(error: unknown, request: ErrorRequest | undefined, context: ErrorContext | undefined): OpsAlertInput {
  const described = describeError(error);
  const routeType = cleanText(context?.routeType, 20) || "unknown";
  const routePath = cleanText(context?.routePath, 150) || "unknown";
  const method = cleanText(request?.method, 12).toUpperCase() || "GET";

  return {
    kind: "server_error",
    key: `${routeType}:${routePath}`,
    subject: `Server error: ${routeType} ${routePath}`,
    facts: [
      { label: "Method", value: method },
      { label: "Path", value: pathWithoutQuery(request?.path) },
      { label: "Route", value: routePath },
      { label: "Route type", value: routeType },
      { label: "Error", value: `${described.name}: ${described.message}` },
      { label: "Digest", value: described.digest || "None" },
    ],
    stack: described.stack.join("\n"),
  };
}

/** Reports one request error. Never throws. */
export async function reportRequestError(
  error: unknown,
  request: ErrorRequest | undefined,
  context: ErrorContext | undefined,
): Promise<void> {
  try {
    const alert = requestErrorAlert(error, request, context);
    const { sendOpsAlert } = await import("./alerts");
    const task = sendOpsAlert(alert);
    const waitUntil = platformWaitUntil();
    if (waitUntil) {
      waitUntil(task);
      return;
    }
    await task;
  } catch (failure) {
    try {
      console.error(`onRequestError: the alert could not be sent: ${cleanText(failure instanceof Error ? failure.message : failure)}`);
    } catch {
      // Logging failed too; the error answer goes out regardless.
    }
  }
}
