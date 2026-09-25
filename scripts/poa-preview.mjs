#!/usr/bin/env node
/**
 * Writes a power of attorney to a PDF so the firm can check the layout and
 * the wording before any client data goes near it.
 *
 *   npm run poa:preview                     blank NIF deed  -> poa-preview.pdf
 *   npm run poa:preview -- --bank           blank bank deed -> poa-preview-bank.pdf
 *   npm run poa:preview -- --filled         sample principal and today's date
 *   npm run poa:preview -- --bank --filled
 *   npm run poa:preview -- --bank --joint   the couple's joint bank deed, both
 *                                           persons, two signature lines
 *                                           -> poa-preview-bank-joint.pdf
 *   npm run poa:preview -- --bank --joint --filled
 *
 * `--joint` implies `--bank`: only the bank deed has a joint form. Its
 * plural wording is ours, not the firm's (src/content/power-of-attorney.ts,
 * JOINT_VOICE), so this preview is what the firm reads to approve it.
 *
 * Every output file is gitignored (poa-preview*.pdf). The generator itself
 * lives in src/lib/poa/generate.ts and is what /api/orders/[id]/poa/[docId]
 * calls with the client's own details.
 */
import { writeFileSync } from "node:fs";

import { PDFDocument } from "pdf-lib";

const { generatePowerOfAttorney } = await import("../src/lib/poa/generate.ts");
const { signingDateFor } = await import("../src/content/power-of-attorney.ts");

const args = new Set(process.argv.slice(2));
const joint = args.has("--joint");
const kind = joint || args.has("--bank") ? "poa_bank" : "poa_nif";
const filled = args.has("--filled");
const file = joint ? "poa-preview-bank-joint.pdf" : kind === "poa_bank" ? "poa-preview-bank.pdf" : "poa-preview.pdf";

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

/** Her partner, for the joint deed: the other gender, so both nascida and nascido show. */
const PARTNER = {
  fullName: "John Michael Doe",
  gender: "m",
  birthPlace: "Denver, Colorado, United States of America",
  birthDate: "1982-11-23",
  passportNumber: "Y7654321",
  passportIssuer: "United States Department of State",
  passportIssueDate: "2022-05-09",
  passportExpiryDate: "2032-05-08",
  taxAddress: "1200 West 6th Street, Apartment 14B, Austin, TX 78703, United States of America",
};

const principals = joint ? (filled ? [SAMPLE, PARTNER] : [{}, {}]) : filled ? SAMPLE : undefined;

const pdf = await generatePowerOfAttorney(kind, principals, filled ? signingDateFor(new Date()) : undefined);
writeFileSync(file, pdf);

const pages = (await PDFDocument.load(pdf)).getPageCount();
const who = filled ? (joint ? "filled with the two sample principals" : "filled with the sample principal") : "blank";
console.log(
  `${file} written: ${kind}${joint ? " joint" : ""} deed, ${who}, ` +
    `${pages} page${pages === 1 ? "" : "s"}, ${(pdf.length / 1024).toFixed(1)} kB`,
);
