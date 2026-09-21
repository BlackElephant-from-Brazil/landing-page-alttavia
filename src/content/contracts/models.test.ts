import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { UserServiceApplicantRow } from "@/lib/db/types";
import {
  CONTRACT_LETTERHEAD,
  CONTRACT_MODELS,
  CONTRACT_MODEL_FILES,
  type ContractBlock,
  type ContractModelId,
} from "./models.generated";
import { KNOWN_TOKENS, buildContractValues } from "./variables";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const TERMS = path.join(ROOT, "docs", "terms");
const SCRIPT = path.join(ROOT, "scripts", "generate-contracts.mjs");
const GENERATED = path.join(ROOT, "src", "content", "contracts", "models.generated.ts");

const IDS: ContractModelId[] = ["nif", "bank", "package", "annex"];
const CONTRACTS = ["nif", "bank", "package"] as const;
const TOKEN = /\[[^\[\]]+\]/g;

function tokensOf(blocks: readonly ContractBlock[]): Set<string> {
  return new Set(blocks.flatMap((block) => block.text.match(TOKEN) ?? []));
}

function count(blocks: readonly ContractBlock[], kind: ContractBlock["kind"]): number {
  return blocks.filter((block) => block.kind === kind).length;
}

/** The paragraph numbers under each clause, as the model wrote them. */
function numbering(blocks: readonly ContractBlock[]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  let clause = "";
  for (const block of blocks) {
    if (block.kind === "clause") clause = block.text;
    if (block.kind === "numbered" && clause) {
      (out[clause] ??= []).push(Number(/^(\d+)\./.exec(block.text)?.[1]));
    }
  }
  return out;
}

describe("generated contract models", () => {
  it("holds one block per paragraph of each model", () => {
    // A change here means a model changed: read the diff of the generated file with the firm's new .docx beside it.
    expect(CONTRACT_MODELS.nif).toHaveLength(157);
    expect(CONTRACT_MODELS.bank).toHaveLength(161);
    expect(CONTRACT_MODELS.package).toHaveLength(175);
    expect(CONTRACT_MODELS.annex).toHaveLength(32);
  });

  it("is up to date with the Word models, byte for byte, and says once what it leaves out", () => {
    if (!existsSync(TERMS)) return; // A checkout without the models has nothing to compare with.
    const run = spawnSync(process.execPath, [SCRIPT, "--stdout"], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    expect(run.status, run.stderr).toBe(0);
    // git stores LF; a Windows checkout with core.autocrlf may hold CRLF.
    const committed = readFileSync(GENERATED, "utf8").replace(/\r\n/g, "\n");
    expect(committed === run.stdout, "models.generated.ts is stale or was edited by hand: run npm run contracts:generate").toBe(true);

    // The logo and the footer drawing are pictures the script does not extract: one warning per run, on stderr.
    expect(run.stderr.match(/Letterhead images are not reproduced/g)).toHaveLength(1);
    expect(run.stdout).not.toContain("Letterhead images are not reproduced");
  });

  it("pins the letterhead the models carry outside their body", () => {
    // The page header's text, the same in the four models. The PDF draws none of it yet (an open question for the
    // firm); it is pinned so a letterhead that changes, or a model that arrives with another one, fails loudly here.
    const LETTERHEAD = [
      "+351 934 548 395",
      "patriciaviana-65755L@adv.oa.pt",
      "https://visas.vianaconsultancy.com/",
      "Av. António Augusto Aguiar, 24, 1st floor right, Office 3, 1050-016, Lisboa",
    ];
    expect(Object.keys(CONTRACT_LETTERHEAD).sort()).toEqual([...IDS].sort());
    for (const id of IDS) expect(CONTRACT_LETTERHEAD[id], id).toEqual(LETTERHEAD);
  });

  it("keeps the letterhead out of the body, so nothing of it is printed by accident", () => {
    for (const id of IDS) {
      const body = CONTRACT_MODELS[id].map((block) => block.text).join("\n");
      for (const line of CONTRACT_LETTERHEAD[id]) expect(body, `${id}: ${line}`).not.toContain(line);
    }
  });

  it("names the Word file of every model", () => {
    for (const id of IDS) {
      expect(CONTRACT_MODEL_FILES[id]).toMatch(/^MODELO - .+\(blank fields\)\.docx$/);
      if (existsSync(TERMS)) expect(existsSync(path.join(TERMS, CONTRACT_MODEL_FILES[id])), id).toBe(true);
    }
  });

  it("uses only tokens variables.ts knows", () => {
    // A new placeholder in a future model fails here instead of printing as a bracket in a client's contract.
    for (const id of IDS) {
      for (const token of tokensOf(CONTRACT_MODELS[id])) expect(KNOWN_TOKENS, `${id}: ${token}`).toContain(token);
    }
  });

  it("knows no token the models have dropped", () => {
    const used = new Set(IDS.flatMap((id) => [...tokensOf(CONTRACT_MODELS[id])]));
    for (const token of KNOWN_TOKENS) expect(used, token).toContain(token);
  });

  it("gives each contract the values its model and Annex I print, and no other", () => {
    const applicant: UserServiceApplicantRow = {
      id: "a",
      user_service_id: "b",
      applicant_index: 0,
      full_name: "Jane Alice Doe",
      gender: "f",
      birth_place: "Austin, Texas",
      birth_date: "1984-07-04",
      passport_number: "X1234567",
      passport_issuer: "United States Department of State",
      passport_issued_on: "2021-03-12",
      passport_expires_on: "2031-03-11",
      tax_address: "1200 West 6th Street, Austin, TX 78703",
      created_at: "2026-09-21T10:00:00Z",
      updated_at: "2026-09-21T10:00:00Z",
    };
    for (const template of CONTRACTS) {
      const printed = new Set([...tokensOf(CONTRACT_MODELS[template]), ...tokensOf(CONTRACT_MODELS.annex)]);
      const values = buildContractValues({
        template,
        applicant,
        email: "jane.doe@example.com",
        totalCents: 14900,
        paidAt: "2026-09-21T10:15:00Z",
        signingPlace: "Austin, United States",
      });
      expect(new Set(Object.keys(values)), template).toEqual(printed);
    }
  });

  it("opens every model with a centred bold title", () => {
    for (const id of IDS) {
      const [title] = CONTRACT_MODELS[id];
      expect(title.kind, id).toBe("title");
      expect(title.center, id).toBe(true);
      expect(title.bold, id).toEqual([[0, title.text.length]]);
    }
    expect(CONTRACT_MODELS.annex[0].text).toBe("ANNEX I");
    for (const template of CONTRACTS) expect(CONTRACT_MODELS[template][0].text).toBe("CONTRACT FOR LEGAL SERVICES");
  });

  it("reads seventeen clauses in each contract, each with its title", () => {
    for (const template of CONTRACTS) {
      const blocks = CONTRACT_MODELS[template];
      expect(count(blocks, "clause"), template).toBe(17);
      expect(count(blocks, "clauseTitle"), template).toBe(17);
      blocks.forEach((block, i) => {
        if (block.kind === "clause") expect(blocks[i + 1].kind, block.text).toBe("clauseTitle");
      });
      expect(blocks.find((b) => b.kind === "clause")?.text).toBe("FIRST CLAUSE");
      expect(blocks.filter((b) => b.kind === "clause").at(-1)?.text).toBe("SEVENTEENTH CLAUSE");
    }
  });

  it("ends each contract with the closing line and the signature block", () => {
    for (const template of CONTRACTS) {
      const blocks = CONTRACT_MODELS[template];
      const heading = blocks.findIndex((b) => b.kind === "signatureHeading");
      expect(blocks[heading - 1].text).toBe("Done in duplicate at Lisbon, on [DAY] [MONTH] [YEAR].");
      expect(blocks[heading - 1].center).toBe(true);
      expect(blocks.slice(heading).map((b) => [b.kind, b.text])).toEqual([
        ["signatureHeading", "SIGNATURES"],
        ["signatureLabel", "The First Party,"],
        ["signatureName", "[FULL NAME]"],
        ["signatureLabel", "The Second Party,"],
        ["signatureName", "PATRÍCIA SOARES VIANA"],
        ["signatureLabel", "For and on behalf of ALTTAVIA RELOCATION, Unipessoal Lda."],
      ]);
    }
  });

  it("reads the three parts of Annex I, each of B and C on its own page as in the model", () => {
    const annex = CONTRACT_MODELS.annex;
    const parts = annex.filter((b) => b.kind === "partHeading");
    expect(parts.map((b) => b.text)).toEqual([
      "PART A — EXPRESS REQUEST AND ACKNOWLEDGEMENT",
      "PART B — INFORMATION ON THE RIGHT OF WITHDRAWAL",
      "PART C — WITHDRAWAL FORM",
    ]);
    expect(parts.map((b) => b.breakBefore === true)).toEqual([false, true, true]);
    expect(annex.filter((b) => b.kind === "formLine").map((b) => b.text.replace(/_+/g, "_"))).toEqual([
      "Place and date: [PLACE], [DAY] [MONTH] [YEAR]",
      "Contract dated: _",
      "Name of the consumer: _",
      "Address of the consumer: _",
      "Date: _",
    ]);
    expect(annex.filter((b) => b.kind === "signatureName").map((b) => b.text)).toEqual([
      "[FULL NAME] — Client",
      "Signature of the consumer (only if this form is notified on paper)",
    ]);
  });

  it("turns the two ballot boxes of Annex I into checkbox blocks and never keeps the character", () => {
    const boxes = CONTRACT_MODELS.annex.filter((b) => b.kind === "checkbox");
    expect(boxes.map((b) => b.text)).toEqual([
      "at a distance or away from business premises;",
      "in person, at the premises of the Second Party — in which case the right of withdrawal does not apply.",
    ]);
    for (const id of IDS) {
      for (const block of CONTRACT_MODELS[id]) expect(block.text).not.toMatch(/[☐-☒]/);
    }
  });

  it("splits labels from text the way the renderer expects", () => {
    for (const id of IDS) {
      for (const block of CONTRACT_MODELS[id]) {
        if (block.kind === "numbered") expect(block.text).toMatch(/^\d+\. \S/);
        if (block.kind === "lettered") expect(block.text).toMatch(/^[a-z]\) \S/);
      }
    }
  });

  it("keeps the text as one trimmed line per paragraph", () => {
    for (const id of IDS) {
      for (const block of CONTRACT_MODELS[id]) {
        expect(block.text.length).toBeGreaterThan(0);
        expect(block.text).toBe(block.text.trim());
        expect(block.text).not.toMatch(/\s{2,}|[\t\n\r ]/);
        expect(block.text).not.toMatch(/&(amp|lt|gt|quot|apos|#\d+);/);
      }
    }
  });

  it("keeps the bold of the models as ranges that never cut a token", () => {
    for (const id of IDS) {
      for (const block of CONTRACT_MODELS[id]) {
        let last = 0;
        for (const [start, end] of block.bold ?? []) {
          expect(start, block.text).toBeGreaterThanOrEqual(last);
          expect(end, block.text).toBeGreaterThan(start);
          expect(end, block.text).toBeLessThanOrEqual(block.text.length);
          // Ranges start and end on ink.
          expect(block.text[start]).not.toBe(" ");
          expect(block.text[end - 1]).not.toBe(" ");
          last = end;
        }
        for (const token of block.text.matchAll(TOKEN)) {
          const from = token.index;
          const to = from + token[0].length;
          for (const [start, end] of block.bold ?? []) {
            const inside = start <= from && to <= end;
            const outside = end <= from || to <= start;
            expect(inside || outside, `${token[0]} in ${block.text.slice(0, 60)}`).toBe(true);
          }
        }
      }
    }

    // The waivers the models make conspicuous are still conspicuous.
    const parties = CONTRACT_MODELS.nif[3];
    expect(parties.text.slice(...(parties.bold?.[0] ?? [0, 0]))).toBe("[FULL NAME]");
    const fee = CONTRACT_MODELS.nif.find((b) => b.text.includes("[TOTAL FEE]"));
    expect(fee?.bold?.map(([s, e]) => fee.text.slice(s, e))).toEqual(["€[TOTAL FEE] ([FEE IN WORDS] euros)"]);
    const lose = CONTRACT_MODELS.annex.find((b) => b.text.startsWith("3. I acknowledge"));
    expect(lose?.bold?.map(([s, e]) => lose.text.slice(s, e))).toEqual([
      "acknowledge and accept",
      "once the contracted services have been fully performed",
      "I lose the right of withdrawal",
    ]);
  });

  it("keeps the models' own numbering, gaps included", () => {
    // Reported to the firm (docs/agreement-contract.md section 8), never fixed here.
    const nif = numbering(CONTRACT_MODELS.nif);
    expect(nif["SEVENTH CLAUSE"]).toEqual([1, 2, 4]);
    expect(nif["NINTH CLAUSE"]).toEqual([1, 2, 4]);

    const bank = numbering(CONTRACT_MODELS.bank);
    expect(bank["SEVENTH CLAUSE"]).toEqual([1, 2, 3, 4]);
    expect(bank["NINTH CLAUSE"]).toEqual([1, 3, 4]);

    const pack = numbering(CONTRACT_MODELS.package);
    expect(pack["SEVENTH CLAUSE"]).toEqual([1, 2, 3, 4]);
    expect(pack["NINTH CLAUSE"]).toEqual([1, 2, 3, 4]);
  });

  it("keeps the typography of the models", () => {
    const nif = CONTRACT_MODELS.nif.map((b) => b.text).join("\n");
    expect(nif).toContain("(Assignment of a Portuguese Tax Identification Number — NIF)");
    expect(nif).toContain("Client’s");
    expect(nif).toContain("€[TOTAL FEE] ([FEE IN WORDS] euros)");
    expect(nif).toContain("Portal das Finanças");
    expect(nif).toContain("Autoridade Tributária e Aduaneira");
  });
});
