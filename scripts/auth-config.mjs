#!/usr/bin/env node
/**
 * Puts the 6 digit code into Supabase Auth's password recovery email, so
 * "Forgot your password?" on /admin/login works with a code instead of a
 * link (src/components/admin/login-form.tsx).
 *
 *   npm run auth:config             dry run: shows what would change, writes nothing
 *   npm run auth:config -- --apply  writes it
 *
 * What it does:
 *
 *   1. GET https://api.supabase.com/v1/projects/<ref>/config/auth with
 *      SUPABASE_ACCESS_TOKEN (read from .env.local with readEnvFile, as in
 *      scripts/stripe-setup.mjs; an explicit environment variable wins).
 *   2. Builds the recovery subject and HTML from the project's own magic
 *      link template, the sign in code email clients already get: the same
 *      markup and inline styles, with the heading and the two lines around
 *      the code rewritten for a password reset. The expiry in the copy comes
 *      from `mailer_otp_exp`.
 *   3. Prints each of the two settings as unchanged or as current and
 *      proposed. Only these two keys are ever printed; the rest of the
 *      config holds secrets (SMTP password, provider secrets) and is never
 *      shown.
 *   4. With --apply, PATCHes those two keys and nothing else, reads the
 *      config back, checks both landed, and lists by name any other key
 *      whose value moved (none should; the `*_custom_contents` flags
 *      Supabase keeps next to the templates are expected to).
 *
 * Running it again after --apply finds nothing to change and says so.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_REF = "dgdbrnvgrpixsslgvmns";
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;

const TOKEN_TAG = "{{ .Token }}";

/** The two settings this script owns. */
const SUBJECT_KEY = "mailer_subjects_recovery";
const TEMPLATE_KEY = "mailer_templates_recovery_content";

/** Keys Supabase derives from the ones above; they may move on a PATCH. */
const DERIVED_KEYS = new Set(["mailer_subjects_custom_contents", "mailer_templates_custom_contents"]);

/**
 * Minimal .env reader, the same one scripts/stripe-setup.mjs uses. CRLF
 * safe, ignores comments and blank lines, strips one pair of quotes.
 */
function readEnvFile(name) {
  const values = {};
  let source;
  try {
    source = readFileSync(join(ROOT, name), "utf8");
  } catch {
    return values;
  }
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (value) values[match[1]] = value;
  }
  return values;
}

const fileEnv = readEnvFile(".env.local");
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || fileEnv.SUPABASE_ACCESS_TOKEN;
const apply = process.argv.includes("--apply");

/** One call to the Management API. The error names the status and the API's own message, never the token. */
async function call(method, body) {
  const res = await fetch(API, {
    method,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const message = json?.message ?? json?.error ?? `HTTP ${res.status}`;
    throw new Error(`${method} config/auth failed (${res.status}): ${message}`);
  }
  if (!json || typeof json !== "object") throw new Error(`${method} config/auth answered something that is not JSON.`);
  return json;
}

function minutesFrom(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.max(1, Math.round(n / 60));
}

/**
 * The recovery email, derived from the magic link template: the heading
 * inside <h1>, the paragraph just before the code and the paragraph just
 * after it are rewritten; the brand line, the code block and every style
 * stay as they are. Throws when the template does not have that shape, so
 * a redesign of the code email is noticed here instead of producing an
 * odd recovery email.
 */
function recoveryTemplate(magicLink, minutes) {
  if (typeof magicLink !== "string" || !magicLink.includes(TOKEN_TAG)) {
    throw new Error(`The magic link template has no ${TOKEN_TAG}; nothing to copy the style from.`);
  }

  const heading = "Your password reset code";
  const lead = `Enter this code on the page you have open, then choose a new password. It expires in ${minutes} minutes and works once.`;
  const footer = "If you did not ask to reset your password, you can ignore this email. Your password stays as it is.";

  if (!/<h1\b[^>]*>[\s\S]*?<\/h1>/.test(magicLink)) {
    throw new Error("The magic link template has no <h1>; update scripts/auth-config.mjs to match it.");
  }
  let html = magicLink.replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/, `$1${heading}$2`);

  const paragraphs = [...html.matchAll(/(<p\b[^>]*>)([\s\S]*?)(<\/p>)/g)];
  const codeAt = paragraphs.findIndex((m) => m[2].includes(TOKEN_TAG));
  const before = paragraphs[codeAt - 1];
  const after = paragraphs[codeAt + 1];
  if (codeAt < 1 || !before || !after || before[2].includes(TOKEN_TAG) || after[2].includes(TOKEN_TAG)) {
    throw new Error(
      "The magic link template does not read brand, heading, line, code, line; update scripts/auth-config.mjs to match it.",
    );
  }

  // Replace from the end so earlier indexes stay valid.
  for (const [match, text] of [
    [after, footer],
    [before, lead],
  ]) {
    const start = match.index;
    html = html.slice(0, start) + `${match[1]}${text}${match[3]}` + html.slice(start + match[0].length);
  }
  return html;
}

function show(label, value) {
  const lines = String(value ?? "(empty)").split(/\r?\n/);
  console.log(`  ${label}:`);
  for (const line of lines) console.log(`    ${line}`);
}

async function main() {
  if (!ACCESS_TOKEN) {
    console.error("Missing in .env.local: SUPABASE_ACCESS_TOKEN");
    console.error("See .env.example for where it comes from.");
    process.exit(1);
  }

  console.log(`\nSupabase Auth config, project ${PROJECT_REF}${apply ? "" : " (dry run)"}\n`);

  const before = await call("GET");
  const minutes = minutesFrom(before.mailer_otp_exp);
  if (before.mailer_otp_length && Number(before.mailer_otp_length) !== 6) {
    console.log(`Note: codes are ${before.mailer_otp_length} digits long; the admin form expects 6.\n`);
  }

  const desired = {
    [SUBJECT_KEY]: `${TOKEN_TAG} is your Alttavia password reset code`,
    [TEMPLATE_KEY]: recoveryTemplate(before.mailer_templates_magic_link_content, minutes),
  };

  const changes = {};
  for (const [key, value] of Object.entries(desired)) {
    if (before[key] === value) {
      console.log(`${key}: unchanged`);
      continue;
    }
    changes[key] = value;
    console.log(`${key}:`);
    show("current", before[key]);
    show("proposed", value);
    console.log("");
  }

  const keys = Object.keys(changes);
  if (keys.length === 0) {
    console.log("\nNothing to change.\n");
    return;
  }
  if (!apply) {
    console.log(`Dry run: ${keys.length} setting(s) would change. Run with --apply to write them.\n`);
    return;
  }

  await call("PATCH", changes);
  const after = await call("GET");

  const missed = keys.filter((key) => after[key] !== desired[key]);
  if (missed.length > 0) throw new Error(`Supabase did not keep: ${missed.join(", ")}`);

  const moved = Object.keys({ ...before, ...after }).filter(
    (key) =>
      !(key in desired) &&
      !DERIVED_KEYS.has(key) &&
      JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null),
  );

  console.log(`Applied: ${keys.join(", ")}`);
  if (moved.length > 0) {
    console.log(`Other keys that changed between the two reads (values not shown): ${moved.join(", ")}`);
  } else {
    console.log("No other setting changed.");
  }
  console.log("");
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
