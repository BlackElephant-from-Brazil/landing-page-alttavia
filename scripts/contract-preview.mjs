#!/usr/bin/env node
/**
 * Writes a contract for legal services (the contract, then Annex I) to a PDF,
 * so the firm can check the layout and the wording before any client data
 * goes near it.
 *
 *   npm run contract:preview                        blank NIF contract -> contract-preview.pdf
 *   npm run contract:preview -- --bank              blank bank contract -> contract-preview-bank.pdf
 *   npm run contract:preview -- --package           blank package contract -> contract-preview-package.pdf
 *   npm run contract:preview -- --filled            sample client, paid today -> contract-preview-filled.pdf
 *   npm run contract:preview -- --package --filled  -> contract-preview-package-filled.pdf
 *
 * Every output file is gitignored. The generator lives in
 * src/lib/contracts/generate.ts and the values come from
 * buildContractValues() in src/content/contracts/variables.ts, the same two
 * calls the platform makes with the client's own details. Runs under tsx
 * because both are TypeScript behind the `@/` alias.
 */
import { writeFileSync } from "node:fs";

import { PDFDocument } from "pdf-lib";

const { generateContractPdf } = await import("../src/lib/contracts/generate.ts");
const { buildContractValues } = await import("../src/content/contracts/variables.ts");
const { PRICE_CENTS } = await import("../src/content/bank-nif.ts");

const args = new Set(process.argv.slice(2));
const template = args.has("--package") ? "package" : args.has("--bank") ? "bank" : "nif";
const filled = args.has("--filled");
const file = `contract-preview${template === "nif" ? "" : `-${template}`}${filled ? "-filled" : ""}.pdf`;

const FEE = { nif: PRICE_CENTS.nifOnly, bank: PRICE_CENTS.bankOnly, package: PRICE_CENTS.bundle };

/** A made up client, long enough in every field to show how a real contract wraps. */
const SAMPLE = {
  id: "00000000-0000-4000-8000-000000000001",
  user_service_id: "00000000-0000-4000-8000-000000000002",
  applicant_index: 0,
  full_name: "Jane Alice Doe",
  gender: "f",
  birth_place: "Austin, Texas, United States of America",
  birth_date: "1984-07-04",
  passport_number: "X1234567",
  passport_issuer: "United States Department of State",
  passport_issued_on: "2021-03-12",
  passport_expires_on: "2031-03-11",
  tax_address: "1200 West 6th Street, Apartment 14B, Austin, TX 78703, United States of America",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const values = filled
  ? buildContractValues({
      template,
      applicant: SAMPLE,
      email: "jane.doe@example.com",
      totalCents: FEE[template],
      paidAt: new Date().toISOString(),
      signingPlace: "Austin, United States",
    })
  : {};

const pdf = await generateContractPdf(template, values, { reference: filled ? "Order SAMPLE-0001" : "Template" });
writeFileSync(file, pdf);

const pages = (await PDFDocument.load(pdf)).getPageCount();
console.log(
  `${file} written: ${template} contract and Annex I, ${filled ? "filled with the sample client" : "blank"}, ` +
    `${pages} page${pages === 1 ? "" : "s"}, ${(pdf.length / 1024).toFixed(1)} kB`,
);
