#!/usr/bin/env node
/**
 * Creates an administrator account for the admin area (/admin).
 *
 *   npm run admin:create                                   info@alttavia-relocation.com
 *   npm run admin:create -- someone@example.com            another address
 *   npm run admin:create -- someone@example.com --reset-password
 *   npm run admin:create -- someone@example.com --reset-password --promote
 *   npm run admin:create -- --support                      the support admin, see below
 *
 * Run it in your own terminal, never through an agent: the password is
 * printed to the screen and would land in the agent's transcript. The one
 * exception is --support, which prints no password and may be run by an
 * agent or a test script.
 *
 * --support (2026-09-21) creates or updates the support admin,
 * business+admin@guyshore.com (the developer's inbox, never the firm's):
 * a new 24 character password every run (letters and digits only, so the
 * .env reader of Next.js neither cuts it at a # nor expands a $), role
 * admin, and then ADMIN_SUPPORT_EMAIL and ADMIN_SUPPORT_PASSWORD written
 * into .env.local. Those two lines are replaced when present and appended
 * otherwise; every other line of the file stays byte for byte. The
 * password is never printed. This is the account the developer and the
 * test scripts sign in to /admin with, since the admin area only accepts a
 * password session (src/lib/supabase/admin-user.ts). The email is fixed,
 * so no typo can promote a client: --reset-password and --promote are
 * implied.
 *
 * What it does, in order:
 *
 *   1. Creates the auth user with `auth.admin.createUser` (secret key,
 *      email confirmed, so no email is sent) and a 20 character password
 *      generated here from crypto.randomBytes: letters, digits and a few
 *      symbols.
 *   2. Sets `public.users.role = 'admin'` for that email through the
 *      Management API (the same endpoint scripts/db-migrate.mjs uses), and
 *      inserts the profile row should the mirror trigger not have made it.
 *   3. Reads the role back and prints it, then prints the password ONCE.
 *
 * The password is never written anywhere: not to .env.local, not to the
 * repo (--support is the one exception, above, and writes only its own
 * account's password). Hand it over and have the owner change it at
 * /admin/settings.
 *
 * If the auth user already exists the script stops with exit code 1 and
 * says how to reset instead; with --reset-password it generates a new
 * password, sets it with `auth.admin.updateUserById`, and still makes sure
 * the role is admin. A reset on an account whose role is client (a customer
 * who signed up on the site) is refused unless --promote is given as well,
 * so a typo in the email never turns a client into an admin.
 *
 * Reads from .env.local (see .env.example): NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SECRET_KEY, SUPABASE_ACCESS_TOKEN. An explicit environment
 * variable wins over the file.
 */

import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createClient } from "@supabase/supabase-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_REF = "dgdbrnvgrpixsslgvmns";
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

const DEFAULT_EMAIL = "info@alttavia-relocation.com";
const PASSWORD_LENGTH = 20;
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+=?";

const SUPPORT_EMAIL = "business+admin@guyshore.com";
const SUPPORT_PASSWORD_LENGTH = 24;
/** No symbols: the value lives in .env.local, where # starts a comment and $ a variable. */
const SUPPORT_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const SUPPORT_ENV_FILE = ".env.local";
const SUPPORT_EMAIL_VAR = "ADMIN_SUPPORT_EMAIL";
const SUPPORT_PASSWORD_VAR = "ADMIN_SUPPORT_PASSWORD";

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
const env = (key) => process.env[key] || fileEnv[key];

const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL");
const SECRET_KEY = env("SUPABASE_SECRET_KEY");
const ACCESS_TOKEN = env("SUPABASE_ACCESS_TOKEN");

const args = process.argv.slice(2);
const support = args.includes("--support");
const resetPassword = support || args.includes("--reset-password");
const promote = support || args.includes("--promote");
const email = support
  ? SUPPORT_EMAIL
  : (args.find((arg) => !arg.startsWith("--")) ?? DEFAULT_EMAIL).trim().toLowerCase();

/**
 * `length` characters from `alphabet`, each picked with rejection sampling
 * so no character is likelier than another. Ambiguous glyphs (0, O, 1, l,
 * I) are left out of both alphabets: the admin password gets read off a
 * screen once.
 */
function generatePassword(length = PASSWORD_LENGTH, alphabet = PASSWORD_ALPHABET) {
  const chars = [];
  const limit = 256 - (256 % alphabet.length);
  while (chars.length < length) {
    for (const byte of randomBytes(length)) {
      if (byte >= limit) continue;
      chars.push(alphabet[byte % alphabet.length]);
      if (chars.length === length) break;
    }
  }
  return chars.join("");
}

/**
 * Sets `values` in .env.local: every line that already assigns one of the
 * names is replaced in place (a stale duplicate further down would
 * otherwise win), the names not found are appended at the end. Every other
 * line, the file's line endings and its final newline stay as they were.
 */
function writeEnvValues(name, values) {
  const path = join(ROOT, name);
  let source = "";
  try {
    source = readFileSync(path, "utf8");
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const wanted = new Map(Object.entries(values));
  const found = new Set();

  const lines = source.length > 0 ? source.split(/\r?\n/) : [];
  const endsWithNewline = /\r?\n$/.test(source);
  if (endsWithNewline) lines.pop();

  const out = lines.map((line) => {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=/);
    if (!match || !wanted.has(match[1])) return line;
    found.add(match[1]);
    return `${match[1]}=${wanted.get(match[1])}`;
  });
  const appended = [...wanted].filter(([key]) => !found.has(key));
  for (const [key, value] of appended) out.push(`${key}=${value}`);

  const body = out.join(eol);
  writeFileSync(path, endsWithNewline || appended.length > 0 ? body + eol : body, "utf8");
}

/** Posts one query to the Management API and returns the rows. */
async function query(sql) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const message = json?.message ?? json?.error ?? text ?? `HTTP ${res.status}`;
    throw new Error(`${message}`.trim());
  }
  return json;
}

/** A string literal for the SQL above. The email is the only value that gets there. */
function literal(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function isEmailTaken(error) {
  return (
    error.code === "email_exists" ||
    error.status === 422 ||
    /already (been )?registered|already exists/i.test(error.message ?? "")
  );
}

async function main() {
  const missing = [
    ["NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL],
    ["SUPABASE_SECRET_KEY", SECRET_KEY],
    ["SUPABASE_ACCESS_TOKEN", ACCESS_TOKEN],
  ].filter(([, value]) => !value);
  if (missing.length > 0) {
    console.error(`Missing in .env.local: ${missing.map(([key]) => key).join(", ")}`);
    console.error("See .env.example for where each one comes from.");
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    console.error(`"${email}" is not an email address.`);
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const password = support
    ? generatePassword(SUPPORT_PASSWORD_LENGTH, SUPPORT_PASSWORD_ALPHABET)
    : generatePassword();
  let action;

  const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true });

  if (!created.error) {
    action = "created";
  } else if (isEmailTaken(created.error)) {
    if (!resetPassword) {
      console.error(`\nAn auth user for ${email} already exists. Nothing was changed.\n`);
      console.error("To give it a new password and make sure it is an admin, run:\n");
      console.error(`  npm run admin:create -- ${email} --reset-password\n`);
      process.exit(1);
    }
    const rows = await query(`select id from auth.users where lower(email) = lower(${literal(email)}) limit 1;`);
    const id = rows?.[0]?.id;
    if (!id) throw new Error(`Supabase says ${email} exists but it is not in auth.users.`);
    const profile = await query(`select role from public.users where id = ${literal(id)} limit 1;`);
    if (profile?.[0]?.role !== "admin" && !promote) {
      console.error(`\n${email} is a client account; pass --promote to make it an admin\n`);
      process.exit(1);
    }
    const updated = await supabase.auth.admin.updateUserById(id, { password, email_confirm: true });
    if (updated.error) throw new Error(`updateUserById failed: ${updated.error.message}`);
    action = "password reset";
  } else {
    throw new Error(`createUser failed: ${created.error.message}`);
  }

  // The mirror trigger on auth.users has made the profile row; the insert
  // below only matters for an auth user that predates the trigger.
  await query(`
    insert into public.users (id, email, role)
    select id, email, 'admin' from auth.users where lower(email) = lower(${literal(email)})
    on conflict (id) do update set role = 'admin';
  `);

  const check = await query(
    `select email, role from public.users where lower(email) = lower(${literal(email)});`,
  );
  const role = check?.[0]?.role;
  if (role !== "admin") throw new Error(`public.users.role for ${email} is "${role ?? "missing"}", not admin.`);

  if (support) {
    try {
      writeEnvValues(SUPPORT_ENV_FILE, { [SUPPORT_EMAIL_VAR]: email, [SUPPORT_PASSWORD_VAR]: password });
    } catch (err) {
      // The account now has a password nobody holds; running again sets a new one.
      throw new Error(
        `The password was set but ${SUPPORT_ENV_FILE} could not be written (${err?.code ?? err?.message}). Run again.`,
      );
    }
    console.log(`\nSupport admin ${action}: ${email}`);
    console.log(`public.users.role = ${role}`);
    console.log(`Password (${SUPPORT_PASSWORD_LENGTH} characters, not shown) written to ${SUPPORT_ENV_FILE}`);
    console.log(`as ${SUPPORT_PASSWORD_VAR}, next to ${SUPPORT_EMAIL_VAR}. Sign in at /admin/login with them.\n`);
    return;
  }

  console.log(`\nAdmin account ${action}: ${email}`);
  console.log(`public.users.role = ${role}\n`);
  console.log("Password, shown once and stored nowhere:\n");
  console.log(`  ${password}\n`);
  console.log("Hand it over and have it changed at /admin/settings right away.\n");
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
