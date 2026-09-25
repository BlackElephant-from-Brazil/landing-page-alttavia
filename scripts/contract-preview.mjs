#!/usr/bin/env node
/**
 * Writes a contract for legal services (the contract, then Annex I) to a PDF,
 * so the firm can check the layout and the wording before any client data
 * goes near it.
 *
 *   npm run contract:preview                        blank NIF contract -> contract-preview.pdf
 *   npm run contract:preview -- --bank              blank bank contract -> contract-preview-bank.pdf
 *   npm run contract:preview -- --package           blank package contract -> contract-preview-package.pdf
 *   npm run contract:preview -- --couple            blank Couple package contract -> contract-preview-couple.pdf
 *   npm run contract:preview -- --filled            sample client, paid today -> contract-preview-filled.pdf
 *   npm run contract:preview -- --couple --filled   sample couple -> contract-preview-couple-filled.pdf
 *   npm run contract:preview -- --signature <png>   with the firm's signature above the Second Party's line
 *                                                   (-signed is added to the file name), shrunk first to
 *                                                   the 600 x 300 pixels the agreements embed at most,
 *                                                   as scripts/firm-signature.mjs uploads it
 *
 * Every output file is gitignored. The generator lives in
 * src/lib/contracts/generate.ts and the values come from
 * buildContractValues() in src/content/contracts/variables.ts, the same two
 * calls the platform makes with the client's own details. Runs under tsx
 * because both are TypeScript behind the `@/` alias.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { PDFDocument } from "pdf-lib";

import { fitPng } from "./lib/png.mjs";

const { generateContractPdf } = await import("../src/lib/contracts/generate.ts");
const { buildContractValues } = await import("../src/content/contracts/variables.ts");
const { PRICE_CENTS } = await import("../src/content/bank-nif.ts");

const argv = process.argv.slice(2);
const args = new Set(argv);
const template = args.has("--couple") ? "couple" : args.has("--package") ? "package" : args.has("--bank") ? "bank" : "nif";
const filled = args.has("--filled");

let signature = null;
const signatureAt = argv.indexOf("--signature");
if (signatureAt >= 0) {
  const path = argv[signatureAt + 1];
  if (!path || path.startsWith("--")) {
    console.error("--signature needs the path of a PNG file: npm run contract:preview -- --signature signature.png");
    process.exit(1);
  }
  signature = new Uint8Array(readFileSync(path));
  // FIRM_SIGNATURE_MAX_PIXELS in src/lib/contracts/generate.ts, which refuses a larger image.
  try {
    const fitted = fitPng(signature, 600, 300, path);
    if (fitted.shrunk) console.log(`${path}: shrunk to ${fitted.width} x ${fitted.height} px, as the upload would be.`);
    signature = new Uint8Array(fitted.bytes);
  } catch (error) {
    console.error(`${path} cannot be read as a PNG to shrink: ${error.message}`);
    process.exit(1);
  }
}

const file = `contract-preview${template === "nif" ? "" : `-${template}`}${filled ? "-filled" : ""}${signature ? "-signed" : ""}.pdf`;

const FEE = { nif: PRICE_CENTS.nifOnly, bank: PRICE_CENTS.bankOnly, package: PRICE_CENTS.bundle, couple: PRICE_CENTS.couple };
const SERVICE = { nif: "nif-only", bank: "bank-only", package: "bundle", couple: "couple" };

const now = new Date().toISOString();

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
  created_at: now,
  updated_at: now,
};

/** Her partner, for the Couple package. */
const PARTNER = {
  ...SAMPLE,
  id: "00000000-0000-4000-8000-000000000003",
  applicant_index: 1,
  full_name: "John Robert Doe",
  gender: "m",
  birth_place: "Denver, Colorado, United States of America",
  birth_date: "1982-11-23",
  passport_number: "Y7654321",
  passport_issued_on: "2022-05-02",
  passport_expires_on: "2032-05-01",
};

const values = filled
  ? buildContractValues({
      order: { total_cents: FEE[template], paid_at: now },
      service: { slug: SERVICE[template], name: SERVICE[template], contract_template: template },
      applicants: template === "couple" ? [SAMPLE, PARTNER] : [SAMPLE],
      email: "jane.doe@example.com",
      signingPlace: "Austin, United States",
    })
  : {};

const pdf = await generateContractPdf(template, values, {
  reference: filled ? "Order SAMPLE-0001" : "Template",
  signature,
});
writeFileSync(file, pdf);

const pages = (await PDFDocument.load(pdf)).getPageCount();
console.log(
  `${file} written: ${template} contract and Annex I, ${filled ? "filled with the sample client" : "blank"}` +
    `${signature ? ", with the firm's signature" : ""}, ${pages} page${pages === 1 ? "" : "s"}, ${(pdf.length / 1024).toFixed(1)} kB`,
);
