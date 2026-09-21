/**
 * The site's own origin, for the absolute URLs the server hands out: the
 * Stripe success and cancel URLs, and the login redirects of the download
 * routes.
 *
 * NEXT_PUBLIC_SITE_URL wins when it is set. Without it the origin is the one
 * the browser used: the forwarded host and protocol of the request (Netlify
 * and the Next.js server both fill them in), then the Host header, then the
 * request URL itself.
 *
 * A dev server started with `-H 0.0.0.0` sees every request URL on 0.0.0.0,
 * an address no browser can open, so 0.0.0.0 and [::] become localhost.
 * A browser on the LAN sends its own Host (192.168.x.y:3000), which is kept.
 *
 * On Netlify's production deploy (`CONTEXT=production`, set by Netlify) a
 * missing NEXT_PUBLIC_SITE_URL is a configuration fault, so it throws at the
 * moment an origin is needed instead of guessing from a header. Deploy
 * previews and branch deploys keep the request fallback.
 *
 * The request fallback trusts the Host header. That is acceptable here: the
 * URL it builds only goes back to the same browser that sent the header, and
 * production never reaches it.
 */

/** The parts of a request this module reads. A `Request` or `NextRequest` fits. */
export type RequestLike = Pick<Request, "headers" | "url">;

/** A hostname (or bracketed IPv6 literal) with an optional port. Nothing else is taken from a header. */
const HOST = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*|\[[0-9a-f:.]+\])(?::\d{1,5})?$/i;

/** Listen addresses that mean "every interface" and cannot be opened in a browser. */
const UNSPECIFIED = new Set(["0.0.0.0", "[::]"]);

/** Netlify sets CONTEXT to production, deploy-preview, branch-deploy or dev. */
function isNetlifyProduction(): boolean {
  return process.env.CONTEXT === "production";
}

/** The first entry of a header that proxies may send as a comma separated list. */
function firstValue(header: string | null): string | null {
  const first = header?.split(",")[0]?.trim();
  return first ? first : null;
}

/**
 * NEXT_PUBLIC_SITE_URL as an origin (scheme, host, port; no path, no trailing
 * slash), or null when it is unset. Throws when it is unset on Netlify's
 * production deploy, and when it is set to something that is not an http or
 * https URL.
 */
export function configuredSiteOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) {
    if (isNetlifyProduction()) {
      throw new Error("NEXT_PUBLIC_SITE_URL must be set on the Netlify production deploy. See .env.example.");
    }
    return null;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an absolute URL such as https://bank-nif-portugal.alttavia-relocation.com.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must start with https:// or http://.");
  }
  return url.origin;
}

/** An origin with 0.0.0.0 or [::] swapped for localhost; any other origin comes back normalised and otherwise unchanged. */
export function browsableOrigin(origin: string): string {
  const url = new URL(origin);
  if (UNSPECIFIED.has(url.hostname)) url.hostname = "localhost";
  return url.origin;
}

/** The origin the browser addressed, read from the request alone. */
function requestOrigin(request: RequestLike): string {
  const fallback = new URL(request.url);

  const forwardedProto = firstValue(request.headers.get("x-forwarded-proto"))?.toLowerCase();
  const protocol = forwardedProto === "https" || forwardedProto === "http" ? `${forwardedProto}:` : fallback.protocol;

  const candidates = [firstValue(request.headers.get("x-forwarded-host")), firstValue(request.headers.get("host"))];
  const host = candidates.find((value): value is string => value !== null && HOST.test(value)) ?? fallback.host;

  return browsableOrigin(`${protocol}//${host}`);
}

/**
 * The origin to build absolute URLs on for this request: NEXT_PUBLIC_SITE_URL
 * when set, else the origin the browser used, never 0.0.0.0. Throws on
 * Netlify's production deploy when NEXT_PUBLIC_SITE_URL is missing.
 */
export function siteOrigin(request: RequestLike): string {
  return configuredSiteOrigin() ?? requestOrigin(request);
}

/**
 * The same rule for a caller that only holds an origin string (for example
 * the Origin header): NEXT_PUBLIC_SITE_URL when set, else that origin with
 * 0.0.0.0 mapped to localhost. Throws where `siteOrigin` throws.
 */
export function siteOriginFrom(origin: string): string {
  return configuredSiteOrigin() ?? browsableOrigin(origin);
}
