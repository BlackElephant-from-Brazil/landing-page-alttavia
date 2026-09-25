/**
 * The platform's emails as pages, for the guide's prints. A scene with an
 * `email` field ({ template, input, to, attachment? }) is not a URL: the
 * template function of src/lib/email/templates.ts is called with the sample
 * input, and its HTML is put inside a plain mail window (subject, sender,
 * recipient, attachment) written to a temporary file that Chrome opens.
 * Nothing is sent.
 *
 * templates.ts has no imports, so Node 24 loads it directly (type
 * stripping); no build and no package is needed. A template that does not
 * exist yet answers null, which a pending scene reads as "not built yet".
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { ROOT } from "./session.mjs";

export const SENDER = "Alttavia Relocation <hello@send.alttavia-relocation.com>";

let templates = null;

async function loadTemplates() {
  if (templates) return templates;
  // Loading a .ts file prints two notices (type stripping, module type); they say nothing useful here.
  const listeners = process.listeners("warning");
  process.removeAllListeners("warning");
  process.on("warning", (warning) => {
    if (warning.code === "MODULE_TYPELESS_PACKAGE_JSON" || warning.name === "ExperimentalWarning") return;
    for (const listener of listeners) listener(warning);
  });
  templates = await import(pathToFileURL(join(ROOT, "src", "lib", "email", "templates.ts")).href);
  return templates;
}

const escapeHtml = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Writes the mail window for a scene and answers its file URL, or null when
 * the template is not in templates.ts (yet).
 */
export async function emailSceneUrl(scene) {
  const all = await loadTemplates();
  const template = all[scene.email.template];
  if (typeof template !== "function") return null;
  const content = template(scene.email.input);
  const body = (content.html.match(/<body[^>]*>([\s\S]*)<\/body>/i) ?? [null, content.html])[1];
  const attachment = scene.email.attachment
    ? `<div class="anexo"><span class="tipo">PDF</span><span>${escapeHtml(scene.email.attachment)}</span></div>`
    : "";
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(content.subject)}</title>
<style>
  body { margin: 0; background: #EEF0F3; font-family: Arial, Helvetica, sans-serif; }
  #email { width: 760px; margin: 40px auto; background: #FFFFFF; border: 1px solid #D9DDE3; border-radius: 10px; overflow: hidden; }
  .cabecalho { padding: 20px 26px 16px; border-bottom: 1px solid #E3E6EA; }
  .assunto { margin: 0 0 12px; font-size: 19px; font-weight: 600; color: #1F2933; }
  .linha { margin: 3px 0; font-size: 13px; color: #52606D; }
  .linha b { display: inline-block; width: 44px; color: #1F2933; font-weight: 600; }
  .anexo { display: inline-flex; align-items: center; gap: 10px; margin-top: 12px; padding: 8px 12px; border: 1px solid #D9DDE3; border-radius: 8px; font-size: 13px; color: #1F2933; }
  .anexo .tipo { font-size: 10px; font-weight: 700; color: #FFFFFF; background: #D0302B; border-radius: 4px; padding: 3px 5px; }
</style>
</head>
<body>
<div id="email">
  <div class="cabecalho">
    <p class="assunto">${escapeHtml(content.subject)}</p>
    <p class="linha"><b>From</b>${escapeHtml(SENDER)}</p>
    <p class="linha"><b>To</b>${escapeHtml(scene.email.to ?? "")}</p>
    ${attachment}
  </div>
  <div class="corpo">${body}</div>
</div>
</body>
</html>`;
  const dir = join(tmpdir(), "alttavia-guide-emails");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${scene.id}.html`);
  writeFileSync(file, page);
  return pathToFileURL(file).href;
}
