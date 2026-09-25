#!/usr/bin/env node
/**
 * Builds the user guide and prints it to PDF with the installed Chrome.
 *
 *   node scripts/guide/pdf.mjs                  docs/guia/Guia-Alttavia.pdf
 *   node scripts/guide/pdf.mjs --out other.pdf  somewhere else
 *   node scripts/guide/pdf.mjs --html-only      only docs/guia/guia.build.html
 *   node scripts/guide/pdf.mjs --numbers        page numbers in the footer
 *   node scripts/guide/pdf.mjs --headful        watch Chrome do it
 *
 * The build: docs/guia/guia.html is the shell (cover, table of contents,
 * print styles); every docs/guia/capitulos/*.html is one chapter, taken in
 * the order of its leading number (00-, 01-, 02-, ... then by name),
 * wrapped in <section class="capitulo" data-arquivo="<file>"> and put where
 * the shell says <!-- CAPITULOS -->. The result is written next to the shell
 * as docs/guia/guia.build.html, so the chapters' prints/<id>.png paths
 * resolve, and can be opened in a browser to check a chapter before
 * printing. The table of contents is built by the shell's own script.
 *
 * The print: Page.printToPDF, A4, printBackground on, header and footer off
 * (unless --numbers), margins from the shell's @page rules (18 mm; none on
 * the cover). Before printing it waits for the fonts and for every image;
 * a print that does not exist yet shows as a dashed box with one plain line
 * for the reader ("Imagem a acrescentar na próxima versão do guia."), and is
 * listed here with the capture command that makes it.
 *
 * No npm package: Chrome is driven by scripts/guide/browser.mjs.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import { openBrowser } from "./browser.mjs";
import { scenes } from "./scenes.mjs";
import { ROOT } from "./session.mjs";

const GUIDE_DIR = join(ROOT, "docs", "guia");
const SHELL = join(GUIDE_DIR, "guia.html");
const CHAPTERS_DIR = join(GUIDE_DIR, "capitulos");
const BUILD = join(GUIDE_DIR, "guia.build.html");
const MARKER = "<!-- CAPITULOS -->";

const argv = process.argv.slice(2);
function argValue(name, fallback) {
  const i = argv.indexOf(name);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--")) return argv[i + 1];
  const inline = argv.find((a) => a.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}
const has = (flag) => argv.includes(flag);
const OUT = join(ROOT, argValue("--out", "docs/guia/Guia-Alttavia.pdf"));

const MM_TO_IN = 1 / 25.4;
const A4 = { width: 210 * MM_TO_IN, height: 297 * MM_TO_IN };

/** Chapter files in reading order: the leading number, then the name. */
export function chapterFiles(dir = CHAPTERS_DIR) {
  if (!existsSync(dir)) return [];
  const leading = (name) => {
    const match = name.match(/^(\d+)/);
    return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
  };
  return readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith(".html"))
    .sort((a, b) => leading(a) - leading(b) || a.localeCompare(b));
}

const escapeAttr = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The shell with every chapter in place. Answers the HTML and the chapter list. */
export function buildGuide() {
  const shell = readFileSync(SHELL, "utf8");
  if (!shell.includes(MARKER)) throw new Error(`${relative(ROOT, SHELL)} has no ${MARKER} marker`);
  const files = chapterFiles();
  const chapters = files.map((name) => {
    const body = readFileSync(join(CHAPTERS_DIR, name), "utf8").replace(/^﻿/, "");
    if (/<\/?(html|body|head)\b/i.test(body)) {
      throw new Error(`capitulos/${name} must be a fragment: no <html>, <head> or <body>`);
    }
    return `<section class="capitulo" data-arquivo="${escapeAttr(name)}">\n${body.trim()}\n</section>`;
  });
  let html = shell.replace(MARKER, `${MARKER}\n${chapters.join("\n\n")}`);
  // The shell's note for an empty build goes once there is a chapter.
  if (chapters.length) html = html.replace(/<!-- VAZIO -->[\s\S]*?<!-- \/VAZIO -->/, "");
  return { html, files };
}

async function main() {
  const { html, files } = buildGuide();
  writeFileSync(BUILD, html);
  console.log(`Built ${relative(ROOT, BUILD).replaceAll("\\", "/")} with ${files.length} chapter${files.length === 1 ? "" : "s"}.`);
  for (const name of files) console.log(`  capitulos/${name}`);
  if (has("--html-only")) return;

  const browser = await openBrowser({ headless: !has("--headful") });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(BUILD).href, { timeoutMs: 90_000 });
    // Fonts from Google Fonts (fallbacks otherwise), and every image settled.
    await page.evaluate(async () => {
      if (document.fonts?.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 15000))]);
    });
    await page.evaluate(() => {
      for (const img of document.images) if (img.loading === "lazy") img.loading = "eager";
    });
    try {
      await page.waitFor(() => [...document.images].every((img) => img.complete), { timeoutMs: 60_000, label: "the images" });
    } catch {
      console.warn("  ! Some images were still loading after 60 s; printing anyway.");
    }
    await page.settle(300);

    // Anything wider than the printed column makes Chrome shrink every page of
    // the PDF. Lay the page out at the column's width in print media and name it.
    const COLUMN_PX = Math.floor(((210 - 2 * 18) / 25.4) * 96);
    await page.send("Emulation.setEmulatedMedia", { media: "print" });
    await page.setViewport({ width: COLUMN_PX, height: 1100, deviceScaleFactor: 1, mobile: false });
    const tooWide = await page.evaluate((limit) => {
      const found = [];
      for (const el of document.querySelectorAll("main *")) {
        const box = el.getBoundingClientRect();
        if (box.right <= limit + 1 || el.closest(".capa")) continue;
        if (found.some((other) => other.contains(el))) continue;
        found.push(el);
      }
      return found.slice(0, 10).map((el) => {
        const chapter = el.closest("section.capitulo")?.getAttribute("data-arquivo") ?? "?";
        return `${chapter}: <${el.tagName.toLowerCase()}> ${(el.textContent || el.getAttribute("src") || "").replace(/\s+/g, " ").trim().slice(0, 70)}`;
      });
    }, COLUMN_PX);
    await page.send("Emulation.setEmulatedMedia", { media: "" });
    await page.setViewport();
    if (tooWide.length) {
      console.warn("  ! Wider than the printed page (Chrome shrinks the whole PDF to fit them):");
      for (const line of tooWide) console.warn(`    ${line}`);
    }

    const report = await page.evaluate(() => ({
      missing: [...new Set([...document.querySelectorAll(".print-em-falta[data-print]")].map((box) => box.getAttribute("data-print")))],
      images: document.images.length,
      chapters: document.querySelectorAll("section.capitulo").length,
      fonts: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, "")),
    }));

    const footer = has("--numbers");
    const pdf = await page.pdf({
      paperWidth: A4.width,
      paperHeight: A4.height,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: footer,
      headerTemplate: "<span></span>",
      footerTemplate: footer
        ? '<div style="width:100%;font-family:Inter,Arial,sans-serif;font-size:8px;color:#5B7199;text-align:center;"><span class="pageNumber"></span></div>'
        : "<span></span>",
      generateDocumentOutline: true,
      generateTaggedPDF: true,
    });
    writeFileSync(OUT, pdf);
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
    const fonts = [...new Set(report.fonts)];
    console.log(
      `Printed ${relative(ROOT, OUT).replaceAll("\\", "/")}: ${pages} pages, ${report.chapters} chapter${report.chapters === 1 ? "" : "s"}, ${report.images} image${report.images === 1 ? "" : "s"}, ${(pdf.length / 1024).toFixed(0)} KB.`,
    );
    console.log(`Fonts loaded: ${fonts.length ? fonts.join(", ") : "none (the fallbacks were used)"}.`);
    if (report.missing.length) {
      console.log(`Prints not taken yet (${report.missing.length}), shown as dashed boxes:`);
      for (const src of report.missing) {
        const id = (src.match(/prints\/([^/]+)\.png$/) || [])[1];
        console.log(`  ${src}${id ? `   (node scripts/guide/capture.mjs --only ${id})` : ""}`);
      }
    }
    // A chapter may ask for a print no scene takes: say so, so a scene gets written.
    const known = new Set(scenes.map((scene) => scene.id));
    const asked = [...new Set([...html.matchAll(/prints\/([a-z0-9-]+)\.png/g)].map((m) => m[1]))];
    const orphans = asked.filter((id) => !known.has(id));
    if (orphans.length) {
      console.log(`Prints the chapters use that no scene in scripts/guide/scenes.mjs takes (${orphans.length}):`);
      for (const id of orphans) console.log(`  ${id}`);
    }
  } finally {
    await browser.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
