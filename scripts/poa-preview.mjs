#!/usr/bin/env node
/**
 * Writes the blank power of attorney to poa-preview.pdf so the firm can check
 * the layout and the wording before any client data goes near it.
 *
 *   npm run poa:preview
 *
 * The generator itself lives in src/lib/poa/generate.ts and is what the app
 * will call once the upload flow knows the client's details.
 */
import { writeFileSync } from "node:fs";

const { generatePowerOfAttorney } = await import("../src/lib/poa/generate.ts");

const pdf = await generatePowerOfAttorney();
writeFileSync("poa-preview.pdf", pdf);
console.log(`poa-preview.pdf written, ${(pdf.length / 1024).toFixed(1)} kB`);
