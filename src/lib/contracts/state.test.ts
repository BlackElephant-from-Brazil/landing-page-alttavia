import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseSigningPlace } from "./signing-place";
import { contractState, contractStatus, missingContractApplicant } from "./state";

const SRC = fileURLToPath(new URL("../../", import.meta.url));

describe("contractState", () => {
  const paid = { paid_at: "2026-09-21T10:15:00.000Z" };
  const unpaid = { paid_at: null };
  const withContract = { contract_template: "nif" as const };
  const row = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" };

  it("answers ready for a row, off without a template or a payment, and needs_details otherwise", () => {
    expect(contractState(paid, withContract, [], row)).toBe("ready");
    expect(contractState(unpaid, null, [], row)).toBe("ready");
    expect(contractState(paid, { contract_template: null }, [], null)).toBe("off");
    expect(contractState(paid, null, [], null)).toBe("off");
    expect(contractState(unpaid, withContract, [], null)).toBe("off");
    expect(contractState(paid, withContract, [], null)).toBe("needs_details");
    expect(contractState(paid, withContract, [{ applicant_index: 0 }], null)).toBe("needs_details");
  });

  it("treats the Couple package like any model: off unpaid, ready with a row, needs_details between", () => {
    const couple = { contract_template: "couple" as const };
    expect(contractState(unpaid, couple, [], null)).toBe("off");
    expect(contractState(paid, couple, [], row)).toBe("ready");
    expect(contractState(paid, couple, [], null)).toBe("needs_details");
    expect(contractState(paid, couple, [{ applicant_index: 0 }, { applicant_index: 1 }], null)).toBe("needs_details");
  });
});

describe("contractStatus", () => {
  const paid = { paid_at: "2026-09-21T10:15:00.000Z" };
  const couple = { contract_template: "couple" as const };
  const nif = { contract_template: "nif" as const };
  const first = { applicant_index: 0 as const };
  const partner = { applicant_index: 1 as const };

  it("names applicant 0 when the account holder's details are missing, whatever the model", () => {
    expect(contractStatus(paid, nif, [], null)).toEqual({ state: "needs_details", missing: 0, persons: 1 });
    expect(contractStatus(paid, couple, [], null)).toEqual({ state: "needs_details", missing: 0, persons: 2 });
    // The partner's row alone does not make up for the account holder's.
    expect(contractStatus(paid, couple, [partner], null)).toEqual({ state: "needs_details", missing: 0, persons: 2 });
  });

  it("names the partner on the Couple package once the account holder's details are in", () => {
    expect(contractStatus(paid, couple, [first], null)).toEqual({ state: "needs_details", missing: 1, persons: 2 });
  });

  it("names nobody once every person the model names has details, and ignores a partner the model does not name", () => {
    expect(contractStatus(paid, couple, [partner, first], null)).toEqual({ state: "needs_details", missing: null, persons: 2 });
    expect(contractStatus(paid, nif, [first], null)).toEqual({ state: "needs_details", missing: null, persons: 1 });
    expect(contractStatus(paid, { contract_template: "package" }, [first], null)).toMatchObject({ missing: null });
  });

  it("says nothing more for off and ready", () => {
    expect(contractStatus({ paid_at: null }, couple, [], null)).toEqual({ state: "off" });
    expect(contractStatus(paid, null, [first], null)).toEqual({ state: "off" });
    expect(contractStatus(paid, couple, [], { id: "x" })).toEqual({ state: "ready" });
  });

  it("finds the first missing person the same way on its own", () => {
    expect(missingContractApplicant("couple", [])).toBe(0);
    expect(missingContractApplicant("couple", [first])).toBe(1);
    expect(missingContractApplicant("couple", [first, partner])).toBeNull();
    expect(missingContractApplicant("bank", [partner])).toBe(0);
    expect(missingContractApplicant("bank", [first])).toBeNull();
    expect(missingContractApplicant(null, [])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// What a module pulls in, followed through the source: every `import` and
// `export ... from` that survives compilation (type only ones do not), local
// files resolved and read in turn, packages recorded by name.
// ---------------------------------------------------------------------------

const STATEMENT = /^[ \t]*(?:import|export)\b([^;'"]*?)\bfrom\s*["']([^"']+)["']|^[ \t]*import\s*["']([^"']+)["']/gm;

function resolveLocal(specifier: string, from: string): string | null {
  const base = specifier.startsWith("@/")
    ? path.join(SRC, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(from), specifier)
      : null;
  if (base === null) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (existsSync(candidate) && /\.tsx?$/.test(candidate)) return candidate;
  }
  throw new Error(`cannot resolve ${specifier} from ${from}`);
}

/** Every module and package `entry` reaches at run time, as "@/lib/x" style paths and package names. */
function reaches(entry: string): Set<string> {
  const seen = new Set<string>();
  const found = new Set<string>();
  const queue = [path.join(SRC, entry)];

  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    for (const [, clause = "", from, sideEffect] of source.matchAll(STATEMENT)) {
      const specifier = from ?? sideEffect;
      // `import type { X }` and `export type { X }` vanish when compiled.
      if (/^\s*type\b/.test(clause)) continue;
      const local = resolveLocal(specifier, file);
      if (local) {
        found.add(`@/${path.relative(SRC, local).replace(/\\/g, "/")}`);
        queue.push(local);
      } else {
        found.add(specifier);
      }
    }
  }
  return found;
}

/** What only the server may load, and what is too heavy for a page that only reads a state. */
function serverOnly(reached: Set<string>): string[] {
  return [...reached].filter(
    (name) =>
      name === "server-only" ||
      name === "pdf-lib" ||
      name.startsWith("@aws-sdk/") ||
      name.startsWith("node:") ||
      name.startsWith("@/lib/supabase/") ||
      name.startsWith("@/lib/r2/client") ||
      name.startsWith("@/lib/email/") ||
      name.startsWith("@/lib/pdf/layout") ||
      name.startsWith("@/lib/contracts/ensure") ||
      name.startsWith("@/lib/contracts/generate") ||
      name.startsWith("@/lib/poa/generate") ||
      name.startsWith("@/content/contracts/models.generated"),
  );
}

describe("what the pure modules pull in", () => {
  it("finds what it is meant to find: ensure.ts does reach the generator, the bucket and the sender", () => {
    const reached = serverOnly(reaches("lib/contracts/ensure.ts"));
    expect(reached).toEqual(expect.arrayContaining(["pdf-lib", "server-only", "@/lib/r2/client.ts", "@/lib/email/send.ts"]));
  });

  it.each([
    "lib/contracts/state.ts",
    "lib/contracts/templates.ts",
    "lib/contracts/signing-place.ts",
    "components/dashboard/contract/prepare-agreement.ts",
    "lib/orders/applicant-rules.ts",
    "lib/pdf/characters.ts",
    "components/ui/scroll-lock.ts",
    "components/dashboard/contract/email-retry.ts",
  ])("%s reaches nothing server only and no PDF library", (entry) => {
    expect(serverOnly(reaches(entry))).toEqual([]);
  });

  it("keeps the order view free of the generator, the bucket and the email sender", () => {
    // order-view.tsx reads contractState; it used to import it from ensure.ts and bundle all three.
    expect(serverOnly(reaches("components/dashboard/order-view.tsx"))).toEqual([]);
  });

  it.each([
    "app/[locale]/dashboard/page.tsx",
    "app/[locale]/dashboard/purchases/page.tsx",
    "app/[locale]/dashboard/orders/[id]/page.tsx",
  ])("keeps %s, a server page with a database behind it, free of the three as well", (entry) => {
    // A page reads the database, so the Supabase clients are its business; preparing an agreement is not.
    const heavy = [...reaches(entry)].filter(
      (name) =>
        name === "pdf-lib" ||
        name.startsWith("@aws-sdk/") ||
        name.startsWith("@/lib/r2/client") ||
        name.startsWith("@/lib/email/") ||
        name.startsWith("@/lib/contracts/ensure") ||
        name.startsWith("@/lib/contracts/generate") ||
        name.startsWith("@/content/contracts/models.generated"),
    );
    expect(heavy).toEqual([]);
  });

  it("keeps the two client components of the agreement free of them too", () => {
    expect(serverOnly(reaches("components/dashboard/contract/contract-gate.tsx"))).toEqual([]);
    expect(serverOnly(reaches("components/dashboard/documents/applicant-details-form.tsx"))).toEqual([]);
  });

  it("still offers both from ensure.ts, for the routes and tests that read them there", () => {
    const source = readFileSync(path.join(SRC, "lib/contracts/ensure.ts"), "utf8");
    expect(source).toContain('export { contractState, type ContractState } from "./state";');
    expect(source).toContain('export { MAX_SIGNING_PLACE_LENGTH, parseSigningPlace, type SigningPlaceResult } from "./signing-place";');
    expect(source).not.toMatch(/export function contractState|export function parseSigningPlace/);
    // And the form's copy of the rule is the route's: one function, imported by both.
    expect(parseSigningPlace("  Austin,  Texas ")).toEqual({ ok: true, value: "Austin, Texas" });
  });
});
