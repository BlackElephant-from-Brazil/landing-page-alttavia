import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { browsableOrigin, configuredSiteOrigin, siteOrigin, siteOriginFrom } from "./site-url";

/**
 * siteOrigin and friends against plain Requests. The environment is stubbed
 * per test and restored after, so a NEXT_PUBLIC_SITE_URL or CONTEXT in the
 * shell running the tests cannot leak in.
 */

const SITE = "https://bank-nif-portugal.alttavia-relocation.com";

function request(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  vi.stubEnv("CONTEXT", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("siteOrigin", () => {
  it("uses NEXT_PUBLIC_SITE_URL when it is set, whatever the request says", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE);
    expect(siteOrigin(request("http://0.0.0.0:3000/api/x", { host: "evil.example" }))).toBe(SITE);
  });

  it("drops a trailing slash or path from NEXT_PUBLIC_SITE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", `${SITE}/`);
    expect(siteOrigin(request("http://localhost:3000/"))).toBe(SITE);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", `  ${SITE}/en  `);
    expect(siteOrigin(request("http://localhost:3000/"))).toBe(SITE);
  });

  it("prefers the forwarded host and protocol of the request", () => {
    const origin = siteOrigin(
      request("http://0.0.0.0:3000/api/x", {
        host: "internal:8080",
        "x-forwarded-host": "preview--alttavia.netlify.app",
        "x-forwarded-proto": "https",
      }),
    );
    expect(origin).toBe("https://preview--alttavia.netlify.app");
  });

  it("takes the first entry of a forwarded list", () => {
    const origin = siteOrigin(
      request("http://0.0.0.0:3000/", { "x-forwarded-host": "a.example, b.example", "x-forwarded-proto": "https, http" }),
    );
    expect(origin).toBe("https://a.example");
  });

  it("falls back to the Host header, then to the request URL", () => {
    expect(siteOrigin(request("http://0.0.0.0:3000/", { host: "192.168.1.20:3000" }))).toBe("http://192.168.1.20:3000");
    expect(siteOrigin(request("http://localhost:3000/api/documents/1"))).toBe("http://localhost:3000");
  });

  it("never answers 0.0.0.0: a dev server on every interface maps to localhost", () => {
    expect(siteOrigin(request("http://0.0.0.0:3000/api/x"))).toBe("http://localhost:3000");
    expect(siteOrigin(request("http://0.0.0.0:3000/api/x", { host: "0.0.0.0:3000" }))).toBe("http://localhost:3000");
    expect(siteOrigin(request("http://[::]:3000/api/x"))).toBe("http://localhost:3000");
  });

  it("ignores a host header that is not a host, and a protocol that is not http or https", () => {
    const origin = siteOrigin(
      request("http://localhost:3000/", {
        "x-forwarded-host": "evil.example/path?x=1",
        host: "bad host",
        "x-forwarded-proto": "javascript",
      }),
    );
    expect(origin).toBe("http://localhost:3000");
  });

  it("throws on Netlify's production deploy when NEXT_PUBLIC_SITE_URL is missing", () => {
    vi.stubEnv("CONTEXT", "production");
    expect(() => siteOrigin(request("https://bank-nif-portugal.alttavia-relocation.com/"))).toThrow(/NEXT_PUBLIC_SITE_URL must be set/);
  });

  it("keeps the request fallback on deploy previews and branch deploys", () => {
    vi.stubEnv("CONTEXT", "deploy-preview");
    expect(siteOrigin(request("https://deploy-preview-7--alttavia.netlify.app/"))).toBe("https://deploy-preview-7--alttavia.netlify.app");
    vi.stubEnv("CONTEXT", "branch-deploy");
    expect(siteOrigin(request("https://develop--alttavia.netlify.app/"))).toBe("https://develop--alttavia.netlify.app");
  });

  it("does not throw on Netlify production once the variable is set", () => {
    vi.stubEnv("CONTEXT", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE);
    expect(siteOrigin(request("http://0.0.0.0:3000/"))).toBe(SITE);
  });
});

describe("configuredSiteOrigin", () => {
  it("is null when unset outside Netlify production", () => {
    expect(configuredSiteOrigin()).toBeNull();
  });

  it("refuses a value that is not an http or https URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "bank-nif-portugal.alttavia-relocation.com");
    expect(() => configuredSiteOrigin()).toThrow(/absolute URL/);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "ftp://bank-nif-portugal.alttavia-relocation.com");
    expect(() => configuredSiteOrigin()).toThrow(/https:\/\/ or http:\/\//);
  });
});

describe("siteOriginFrom", () => {
  it("uses the variable when set, else the given origin without 0.0.0.0", () => {
    expect(siteOriginFrom("http://0.0.0.0:3000")).toBe("http://localhost:3000");
    expect(siteOriginFrom("http://192.168.1.20:3000/")).toBe("http://192.168.1.20:3000");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE);
    expect(siteOriginFrom("http://0.0.0.0:3000")).toBe(SITE);
  });

  it("throws on Netlify production without the variable", () => {
    vi.stubEnv("CONTEXT", "production");
    expect(() => siteOriginFrom("https://bank-nif-portugal.alttavia-relocation.com")).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
});

describe("browsableOrigin", () => {
  it("only rewrites the unspecified addresses", () => {
    expect(browsableOrigin("http://0.0.0.0:3100")).toBe("http://localhost:3100");
    expect(browsableOrigin("https://example.com/")).toBe("https://example.com");
    expect(browsableOrigin("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
  });
});
