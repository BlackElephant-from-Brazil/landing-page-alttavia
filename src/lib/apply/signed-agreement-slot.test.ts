import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { isAgreementTemplate } from "@/lib/documents/templates";

import { DEED_SIGNATURE_NOTE, SIGNED_AGREEMENT_SLOT } from "./documents";

/**
 * The signed agreement slot is copy and configuration the client reads from
 * `service_docs`, written by supabase/migrations/0013_signed_agreement_slot.sql.
 * SIGNED_AGREEMENT_SLOT is its seed source, worth nothing unless the two say
 * the same thing. These tests read the migration and hold them together.
 */

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const MIGRATION = join(ROOT, "supabase", "migrations", "0013_signed_agreement_slot.sql");
const SCHEMA = join(ROOT, "supabase", "migrations", "0001_schema.sql");

const sql = readFileSync(MIGRATION, "utf8");

/** The single quoted literals of the insert's select list, in order. */
function insertedLiterals(): string[] {
  const select = /insert into public\.service_docs[\s\S]*?\bselect\b([\s\S]*?)\bfrom public\.services s/.exec(sql)?.[1] ?? "";
  return [...select.matchAll(/'([^']*)'/g)].map((m) => m[1]);
}

describe("signed agreement slot", () => {
  it("is the row the migration inserts: key, label, note, file types and template", () => {
    const literals = insertedLiterals();

    expect(literals).toEqual([
      SIGNED_AGREEMENT_SLOT.key,
      SIGNED_AGREEMENT_SLOT.label,
      SIGNED_AGREEMENT_SLOT.note,
      `{${SIGNED_AGREEMENT_SLOT.acceptedMime.join(",")}}`,
      SIGNED_AGREEMENT_SLOT.template,
    ]);
  });

  it("goes to the four services that carry a contract, by slug", () => {
    const slugs = /where s\.slug in \(([^)]*)\)/.exec(sql)?.[1] ?? "";

    expect([...slugs.matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual([...SIGNED_AGREEMENT_SLOT.services]);
    expect(SIGNED_AGREEMENT_SLOT.services).toContain("couple");
  });

  it("is one slot per order, required, with the size limit of every other slot", () => {
    expect(SIGNED_AGREEMENT_SLOT.perApplicant).toBe(false);
    expect(SIGNED_AGREEMENT_SLOT.required).toBe(true);
    expect(sql).toMatch(/10485760,\s*false,\s*true,/);

    // The column defaults every other slot was seeded with (0001_schema.sql).
    const schema = readFileSync(SCHEMA, "utf8");
    expect(schema).toContain(`accepted_mime  text[] not null default '{${SIGNED_AGREEMENT_SLOT.acceptedMime.join(",")}}'`);
    expect(schema).toContain(`max_bytes      integer not null default ${SIGNED_AGREEMENT_SLOT.maxBytes}`);
  });

  it("lets the template check take the new value and keeps the two deeds", () => {
    expect(sql).toContain("check (template in ('poa_nif', 'poa_bank', 'agreement'))");
    expect(isAgreementTemplate(SIGNED_AGREEMENT_SLOT.template)).toBe(true);
  });

  it("sits after the last row of each service and never inserts twice", () => {
    expect(sql).toContain("coalesce(max(d.position), 0) from public.service_docs d where d.service_id = s.id) + 1");
    expect(sql).toContain("on conflict (service_id, key) do nothing");
    expect(sql).toMatch(/not exists \([\s\S]*d\.key = 'signed_agreement'/);
  });

  it("asks for the passport signature, as the deeds do", () => {
    expect(SIGNED_AGREEMENT_SLOT.note).toContain("same signature as in your passport");
    expect(DEED_SIGNATURE_NOTE).toContain("same signature as in your passport");
  });

  it("keeps the house rules: no dash as punctuation, none of the banned words", () => {
    for (const copy of [SIGNED_AGREEMENT_SLOT.label, SIGNED_AGREEMENT_SLOT.note]) {
      expect(copy).not.toMatch(/[–—]/);
      expect(copy).not.toMatch(/\s-\s/);
      expect(copy).not.toMatch(/\b(problem|trap|free|refund|money back|video call|run by lawyers)\b/i);
    }
  });
});
