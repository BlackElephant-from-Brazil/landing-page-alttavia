import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cleanFacts,
  cleanText,
  cut,
  describeError,
  lisbonTimestamp,
  opsEnvironment,
  pathWithoutQuery,
  redact,
  stackLines,
  subjectPrefix,
} from "./format";

/**
 * The pure half of the operations alerts: the environment prefix, and what
 * every value goes through before it can reach an email. No I/O.
 */

describe("subjectPrefix", () => {
  it("reads Netlify's CONTEXT: production, staging for branch deploys and previews, local for the rest", () => {
    expect(subjectPrefix("production")).toBe("[production]");
    expect(subjectPrefix("branch-deploy")).toBe("[staging]");
    expect(subjectPrefix("deploy-preview")).toBe("[staging]");
    expect(subjectPrefix("dev")).toBe("[local]");
    expect(subjectPrefix(undefined)).toBe("[local]");
    expect(subjectPrefix("")).toBe("[local]");
    expect(opsEnvironment("branch-deploy", undefined)).toBe("staging");
  });

  it("prefers OPS_ENVIRONMENT, which Netlify functions can read at run time, and ignores an unknown value", () => {
    expect(opsEnvironment(undefined, "production")).toBe("production");
    expect(opsEnvironment("production", " Staging ")).toBe("staging");
    expect(opsEnvironment("branch-deploy", "local")).toBe("local");
    expect(opsEnvironment("branch-deploy", "prod")).toBe("staging");
    expect(subjectPrefix(undefined, "production")).toBe("[production]");
  });
});

describe("the default environment on Netlify", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the build time copy of CONTEXT that next.config.ts writes, when the function has none", () => {
    vi.stubEnv("OPS_ENVIRONMENT", "");
    vi.stubEnv("CONTEXT", "");
    vi.stubEnv("NETLIFY_BUILD_CONTEXT", "production");
    expect(subjectPrefix()).toBe("[production]");
    vi.stubEnv("NETLIFY_BUILD_CONTEXT", "branch-deploy");
    expect(subjectPrefix()).toBe("[staging]");
    vi.stubEnv("CONTEXT", "production");
    expect(opsEnvironment()).toBe("production");
    vi.stubEnv("OPS_ENVIRONMENT", "local");
    expect(opsEnvironment()).toBe("local");
  });
});

describe("redact", () => {
  it("turns anything that looks like an email address into [email], encoded ones too", () => {
    expect(redact("duplicate key for ana.silva+nif@example.co.uk here")).toBe("duplicate key for [email] here");
    expect(redact("user O'Hara@Example.COM")).toBe("user O'[email]");
    expect(redact("/en/login?email=ana%40example.com")).not.toContain("example.com");
    expect(redact("two: a@b.pt, c@d.com")).toBe("two: [email], [email]");
  });

  it("keeps package versions and plain text", () => {
    expect(redact("at node_modules/@supabase/supabase-js@2.116.0/dist/main.js:1:2")).toContain("@supabase/supabase-js@2.116.0");
    expect(redact("Order not found.")).toBe("Order not found.");
  });

  it("drops query strings, tokens, keys and Postgres row dumps", () => {
    expect(redact("GET https://x.example/api/a?token=abc&next=/en")).toBe("GET https://x.example/api/a?[query]");
    expect(redact("Is it paid? No.")).toBe("Is it paid? No.");
    expect(redact("bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcDEF123")).toBe("bearer [token]");
    expect(redact("key sk_live_51Habcdefghijkl and whsec_abcdefghijklmnop")).toBe("key [secret] and [secret]");
    expect(redact('new row violates check. Failing row contains (1, John Smith, AB123456, 1990-01-01).')).toBe(
      "new row violates check. Failing row contains [row].",
    );
    expect(redact("Key (passport_number)=(AB123456) already exists.")).toBe("Key [values] already exists.");
  });

  it("cuts a row dump to the end of its line, whatever parentheses the values hold", () => {
    expect(redact("Failing row contains (id, Maria (Silva), P1234567, 1990-01-01).")).toBe("Failing row contains [row].");
    expect(redact("check failed\nFailing row contains (x, Lisbon (Portugal), P1234567).\nnext line")).toBe(
      "check failed\nFailing row contains [row].\nnext line",
    );
    expect(redact("Key (lower(email::text))=(Maria Silva) already exists.")).toBe("Key [values] already exists.");
    expect(redact('Key (user_id)=(P1234567) is not present in table "users".')).toBe('Key [values] is not present in table "users".');
    expect(redact("Key (a)=(Maria (Silva)) conflicts with existing key (a)=(P1234567).")).toBe("Key [values]");
    for (const dump of ["Failing row contains (id, Maria (Silva), P1234567, 1990-01-01).", "Key (a)=(Maria (Silva)) x P1234567"]) {
      expect(redact(dump)).not.toMatch(/P1234567|Maria|1990/);
    }
  });
});

describe("cut and cleanText", () => {
  it("cuts to 300 characters by default, ending in three dots", () => {
    const long = "x".repeat(1000);
    expect(cut(long)).toHaveLength(300);
    expect(cut(long).endsWith("...")).toBe(true);
    expect(cut("short")).toBe("short");
    expect(cleanText(long)).toHaveLength(300);
  });

  it("folds whitespace and reads anything as text without throwing", () => {
    expect(cleanText("a\n\n  b\tc")).toBe("a b c");
    expect(cleanText(null)).toBe("");
    expect(cleanText(undefined)).toBe("");
    expect(cleanText(42)).toBe("42");
    const hostile = {
      toString() {
        throw new Error("no");
      },
    };
    expect(cleanText(hostile)).toBe("");
  });

  it("redacts before it cuts, so an address at the edge never survives in part", () => {
    const value = `${"y".repeat(290)} someone@example.com`;
    expect(cleanText(value)).not.toContain("someone");
  });
});

describe("stackLines", () => {
  it("keeps at most the first 5 frames, cleaned, without the message lines", () => {
    const stack = [
      "Error: failed for ana@example.com",
      "    at one (/var/task/a.js:1:1)",
      "    at two (/var/task/b.js:2:2)",
      "    at three (/var/task/c.js:3:3)",
      "    at four (/var/task/d.js:4:4)",
      "    at five (/var/task/e.js:5:5)",
      "    at six (/var/task/f.js:6:6)",
    ].join("\n");

    const lines = stackLines(stack);

    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe("at one (/var/task/a.js:1:1)");
    expect(lines.join("\n")).not.toContain("six");
    expect(lines.join("\n")).not.toContain("ana@");
  });

  it("is empty for anything that is not a stack", () => {
    expect(stackLines(undefined)).toEqual([]);
    expect(stackLines(42)).toEqual([]);
    expect(stackLines("Error: no frames")).toEqual([]);
  });
});

describe("cleanFacts and pathWithoutQuery", () => {
  it("cleans every value and fills an empty one", () => {
    expect(
      cleanFacts([
        { label: "Client", value: "ana@example.com" },
        { label: "Order", value: "" },
      ]),
    ).toEqual([
      { label: "Client", value: "[email]" },
      { label: "Order", value: "Not given" },
    ]);
  });

  it("drops the query string and the fragment of a path", () => {
    expect(pathWithoutQuery("/en/login?next=/en/dashboard&email=a@b.com")).toBe("/en/login");
    expect(pathWithoutQuery("/admin/orders#top")).toBe("/admin/orders");
    expect(pathWithoutQuery(undefined)).toBe("");
  });
});

describe("describeError", () => {
  it("reads name, message, digest and frames", () => {
    const error = Object.assign(new TypeError("Cannot read id of ana@example.com"), { digest: "123456789" });
    const described = describeError(error);

    expect(described.name).toBe("TypeError");
    expect(described.message).toBe("Cannot read id of [email]");
    expect(described.digest).toBe("123456789");
    expect(described.stack.length).toBeGreaterThan(0);
    expect(described.stack.length).toBeLessThanOrEqual(5);
  });

  it("never throws, whatever was thrown", () => {
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error("hostile getter");
        },
      },
    );
    expect(describeError(hostile)).toEqual({ name: "Error", message: "No message", digest: "", stack: [] });
    expect(describeError("plain words")).toMatchObject({ name: "Thrown string", message: "plain words" });
    expect(describeError(null)).toMatchObject({ name: "Error", message: "No message" });
  });
});

describe("lisbonTimestamp", () => {
  it("prints the time in Lisbon, one hour ahead of UTC in summer", () => {
    expect(lisbonTimestamp(new Date("2026-09-28T13:03:12Z"))).toContain("14:03:12");
  });
});
