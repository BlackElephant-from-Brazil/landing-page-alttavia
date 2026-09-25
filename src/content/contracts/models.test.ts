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
import { KNOWN_TOKENS, PARTNER_TOKENS, buildContractValues } from "./variables";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const TERMS = path.join(ROOT, "docs", "terms");
const ORIGINALS = path.join(TERMS, "originais-2026-09-21");
const SCRIPT = path.join(ROOT, "scripts", "generate-contracts.mjs");
const EDIT_SCRIPT = path.join(ROOT, "scripts", "edit-contract-models.mjs");
const GENERATED = path.join(ROOT, "src", "content", "contracts", "models.generated.ts");

const IDS: ContractModelId[] = ["nif", "bank", "package", "couple", "annex"];
const CONTRACTS = ["nif", "bank", "package", "couple"] as const;
const TOKEN = /\[[^\[\]]+\]/g;

/** Patrícia's answers of 2026-09-24, as the models now say them. */
const NEW_ADDRESS = "Av. António Augusto Aguiar, 24, 1st floor right, Office 3, 1050-016 Lisbon, Portugal";
const FEE_SENTENCE = "1. The total fee for the services described in this contract is €[TOTAL FEE] ([FEE IN WORDS] euros), VAT included.";

function textOf(id: ContractModelId): string {
  return CONTRACT_MODELS[id].map((block) => block.text).join("\n");
}

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
    // The package model plus the partner's signature line.
    expect(CONTRACT_MODELS.couple).toHaveLength(176);
    expect(CONTRACT_MODELS.annex).toHaveLength(32);
  });

  it("is up to date with the Word models and the letterhead logo, as --check sees them", () => {
    if (!existsSync(TERMS)) return;
    const run = spawnSync(process.execPath, [SCRIPT, "--check"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    expect(run.status, run.stderr || run.stdout).toBe(0);
  });

  it("reads models that are the originals with Patrícia's changes, byte for byte", () => {
    // docs/terms is written by scripts/edit-contract-models.mjs from the originals of 2026-09-21; nothing else edits it.
    if (!existsSync(ORIGINALS)) return;
    const run = spawnSync(process.execPath, [EDIT_SCRIPT, "--check"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    expect(run.status, run.stderr || run.stdout).toBe(0);
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

    // The icon column and the footer drawing are pictures the PDF does not draw: one warning per run, on stderr.
    expect(run.stderr.match(/Letterhead pictures not reproduced/g)).toHaveLength(1);
    expect(run.stdout).not.toContain("Letterhead pictures not reproduced");
  });

  it("pins the letterhead the models carry outside their body", () => {
    // The page header's text, the same in the five models, printed at the top right of a contract's first page.
    // Pinned so a letterhead that changes, or a model that arrives with another one, fails loudly here.
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
    const partner: UserServiceApplicantRow = { ...applicant, id: "c", applicant_index: 1, full_name: "John Robert Doe" };
    for (const template of CONTRACTS) {
      // Annex I for the Couple package also names the partner, with tokens its contract already has.
      const printed = new Set([...tokensOf(CONTRACT_MODELS[template]), ...tokensOf(CONTRACT_MODELS.annex)]);
      const values = buildContractValues({
        order: { total_cents: 14900, paid_at: "2026-09-21T10:15:00Z" },
        service: { slug: template, name: template, contract_template: template },
        applicants: [applicant, partner],
        email: "jane.doe@example.com",
        signingPlace: "Austin, United States",
      });
      expect(new Set(Object.keys(values)), template).toEqual(printed);
    }
  });

  it("names the partner in the Couple package with the first person's tokens and a 2, and nowhere else", () => {
    const couple = tokensOf(CONTRACT_MODELS.couple);
    for (const token of PARTNER_TOKENS) expect(couple, token).toContain(token);
    for (const id of IDS.filter((id) => id !== "couple")) {
      for (const token of PARTNER_TOKENS) expect(tokensOf(CONTRACT_MODELS[id]), `${id}: ${token}`).not.toContain(token);
    }
  });

  it("carries Patrícia's answers of 2026-09-24 in every model: the new address, VAT included", () => {
    for (const id of IDS) {
      const text = textOf(id);
      expect(text, id).toContain(NEW_ADDRESS);
      expect(text, id).not.toContain("Elias Garcia");
      expect(text, id).not.toContain("1050-098");
      expect(text, id).not.toContain("plus VAT");
    }
    for (const template of CONTRACTS) {
      // The fee paragraph, and the only mention of VAT in the contract.
      expect(CONTRACT_MODELS[template].filter((b) => b.text.includes("VAT")).map((b) => b.text), template).toEqual([FEE_SENTENCE]);
      const parties = CONTRACT_MODELS[template].find((b) => b.text.startsWith("ALTTAVIA RELOCATION, Unipessoal Lda."));
      expect(parties?.text, template).toContain(`with registered office at ${NEW_ADDRESS}, duly represented by`);
    }
    expect(textOf("annex")).toContain(`To: ALTTAVIA RELOCATION, Unipessoal Lda., ${NEW_ADDRESS} — [EMAIL OF THE SECOND PARTY]`);
    expect(textOf("annex")).not.toContain("VAT");
  });

  it("derives the Couple package from the package model, changing only the title, the parties and the signatures", () => {
    const pack = CONTRACT_MODELS.package;
    const couple = CONTRACT_MODELS.couple;
    const partnerLine = couple.findIndex((b) => b.text === "[FULL NAME 2]");
    // The couple is the package with one block more, the partner's signature line; every other block is the same but two.
    const aligned = [...couple.slice(0, partnerLine), ...couple.slice(partnerLine + 1)];
    expect(aligned).toHaveLength(pack.length);
    const changed = aligned.map((block, i) => (JSON.stringify(block) === JSON.stringify(pack[i]) ? -1 : i)).filter((i) => i >= 0);
    expect(changed).toEqual([1, 3]);

    expect(couple[1].text).toBe(
      "(Couple Package — Portuguese Tax Identification Number (NIF) and Opening of a Portuguese Bank Account)",
    );
    // Our drafting, read by the firm: both persons, the shared email, "jointly".
    expect(couple[3].text).toBe(
      "[FULL NAME], born in [PLACE OF BIRTH], on [DATE OF BIRTH], of legal age, holder of passport no. [PASSPORT NO.], " +
        "issued by [PASSPORT ISSUING AUTHORITY] on [DATE OF ISSUE], valid until [EXPIRY DATE], tax resident at " +
        "[TAX RESIDENCE ADDRESS], and [FULL NAME 2], born in [PLACE OF BIRTH 2], on [DATE OF BIRTH 2], of legal age, " +
        "holder of passport no. [PASSPORT NO. 2], issued by [PASSPORT ISSUING AUTHORITY 2] on [DATE OF ISSUE 2], valid " +
        "until [EXPIRY DATE 2], tax resident at [TAX RESIDENCE ADDRESS 2], both with email address [EMAIL], hereinafter " +
        "jointly referred to as the First Party or Client;",
    );
    expect(couple[3].bold?.map(([s, e]) => couple[3].text.slice(s, e))).toEqual(["[FULL NAME]", "[FULL NAME 2]"]);
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
      // The Couple package has two First Party lines, one per person.
      const firstParty: [string, string][] =
        template === "couple"
          ? [
              ["signatureName", "[FULL NAME]"],
              ["signatureName", "[FULL NAME 2]"],
            ]
          : [["signatureName", "[FULL NAME]"]];
      expect(blocks.slice(heading).map((b) => [b.kind, b.text])).toEqual([
        ["signatureHeading", "SIGNATURES"],
        ["signatureLabel", "The First Party,"],
        ...firstParty,
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

  it("numbers the paragraphs of every clause 1, 2, 3 with no gap", () => {
    // The gaps of the originals (NIF: Seventh and Ninth Clauses 1, 2, 4; bank: Ninth Clause 1, 3, 4) were closed
    // on Patrícia's instruction of 2026-09-24 by scripts/edit-contract-models.mjs.
    for (const template of CONTRACTS) {
      const clauses = numbering(CONTRACT_MODELS[template]);
      expect(Object.keys(clauses).length, template).toBeGreaterThan(10);
      for (const [clause, numbers] of Object.entries(clauses)) {
        expect(numbers, `${template} ${clause}`).toEqual(numbers.map((_, i) => i + 1));
      }
    }
    expect(numbering(CONTRACT_MODELS.nif)["SEVENTH CLAUSE"]).toEqual([1, 2, 3]);
    expect(numbering(CONTRACT_MODELS.nif)["NINTH CLAUSE"]).toEqual([1, 2, 3]);
    expect(numbering(CONTRACT_MODELS.bank)["NINTH CLAUSE"]).toEqual([1, 2, 3]);

    // Annex I, Part A, counts 1 to 5.
    const partA = CONTRACT_MODELS.annex.filter((b) => b.kind === "numbered").map((b) => Number(/^(\d+)\./.exec(b.text)?.[1]));
    expect(partA).toEqual([1, 2, 3, 4, 5]);
  });

  it("letters the items of every list a, b, c with no gap", () => {
    for (const id of IDS) {
      let expected = 0;
      let previous: ContractBlock["kind"] | undefined;
      for (const block of CONTRACT_MODELS[id]) {
        if (block.kind === "lettered") {
          expected = previous === "lettered" ? expected + 1 : 0;
          expect(block.text[0], `${id}: ${block.text.slice(0, 40)}`).toBe(String.fromCharCode(97 + expected));
        }
        previous = block.kind;
      }
    }
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
