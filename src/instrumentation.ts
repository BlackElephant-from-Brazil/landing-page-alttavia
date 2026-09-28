import type { Instrumentation } from "next";

/**
 * Next.js instrumentation (node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/instrumentation.md). Only `onRequestError` is used:
 * Next.js calls it for every server error it catches in a page, a route
 * handler, a server action or the proxy, and this hands it to
 * src/lib/ops/request-error.ts, which emails an operations alert
 * (src/lib/ops/alerts.ts: production builds only, throttled, cleaned).
 * No `register`: nothing has to run when a server starts.
 *
 * Node.js runtime only. The file is also built for the edge runtime, where
 * the admin client and the email sender do not belong, so the work is behind
 * `process.env.NEXT_RUNTIME === "nodejs"` (inlined at build time) and a
 * dynamic import.
 *
 * It never throws and never recurses: the alert goes out through fetch, not
 * through a Next.js handler, and anything that fails here is logged only.
 * Next.js logs the original error itself, before this runs.
 */

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // The guard wraps the import, as the Next.js docs write it, so the edge
  // build drops the whole branch instead of relying on code after a return.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { reportRequestError } = await import("@/lib/ops/request-error");
      await reportRequestError(error, request, context);
    } catch (failure) {
      try {
        console.error(
          "onRequestError: the alert could not be prepared:",
          failure instanceof Error ? failure.name : typeof failure,
        );
      } catch {
        // Logging failed too; the error answer goes out regardless.
      }
    }
  }
};
