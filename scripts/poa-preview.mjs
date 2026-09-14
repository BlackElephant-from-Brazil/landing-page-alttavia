#!/usr/bin/env node
/**
 * Writes a power of attorney to a PDF so the firm can check the layout and
 * the wording before any client data goes near it.
 *
 *   npm run poa:preview                     blank NIF deed  -> poa-preview.pdf
 *   npm run poa:preview -- --bank           blank bank deed -> poa-preview-bank.pdf
 *   npm run poa:preview -- --filled         sample principal and today's date
 *   npm run poa:preview -- --bank --filled
 *
 * Both output files are gitignored. The generator itself lives in
 * src/lib/poa/generate.ts and is what /api/orders/[id]/poa/[docId] calls
 * with the client's own details.
 */
import { writeFileSync } from "node:fs";

import { PDFDocument } from "pdf-lib";

const { generatePowerOfAttorney } = await import("../src/lib/poa/generate.ts");
const { signingDateFor } = await import("../src/content/power-of-attorney.ts");

const args = new Set(process.argv.slice(2));
const kind = args.has("--bank") ? "poa_bank" : "poa_nif";
const filled = args.has("--filled");
const file = kind === "poa_bank" ? "poa-preview-bank.pdf" : "poa-preview.pdf";

/** A made up principal, long enough in every field to show how a real deed wraps. */
const SAMPLE = {
  fullName: "Jane Alice Doe",
  gender: "f",
  birthPlace: "Austin, Texas, United States of America",
  birthDate: "1984-07-04",
  passportNumber: "X1234567",
  passportIssuer: "United States Department of State",
  passportIssueDate: "2021-03-12",
  passportExpiryDate: "2031-03-11",
  taxAddress: "1200 West 6th Street, Apartment 14B, Austin, TX 78703, United States of America",
};

const pdf = await generatePowerOfAttorney(
  kind,
  filled ? SAMPLE : undefined,
  filled ? signingDateFor(new Date()) : undefined,
);
writeFileSync(file, pdf);

const pages = (await PDFDocument.load(pdf)).getPageCount();
console.log(
  `${file} written: ${kind} deed, ${filled ? "filled with the sample principal" : "blank"}, ` +
    `${pages} page${pages === 1 ? "" : "s"}, ${(pdf.length / 1024).toFixed(1)} kB`,
);
