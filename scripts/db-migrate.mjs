#!/usr/bin/env node
/**
 * Applies the SQL files in supabase/migrations to the Supabase project, in
 * filename order, each one once.
 *
 *   npm run db:migrate            apply every file not yet recorded
 *   npm run db:migrate -- --dry   list what would run, change nothing
 *
 * Files with "_seed_" in the name run every time, recorded or not; their
 * inserts are upserts, so a seed edit needs no new file.
 *
 * There is no database URL and no psql involved: every file is posted to the
 * Supabase Management API (POST /v1/projects/{ref}/database/query) with the
 * personal access token read from .env.local (SUPABASE_ACCESS_TOKEN). An
 * explicit environment variable still wins, so CI can override without
 * editing a file.
 *
 * Bookkeeping lives in public.schema_migrations(name, applied_at), created
 * here before anything else. A file is recorded in the same request that
 * runs it, so the record and the migration succeed or fail together: the
 * API runs the statements of one request in one implicit transaction.
 *
 * The first failure stops the run, prints the message Postgres gave, and
 * exits non zero. Files after it are left for the next run.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const PROJECT_REF = "dgdbrnvgrpixsslgvmns";
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

const CREATE_LEDGER = `
create table if not exists public.schema_migrations (
  name        text primary key,
  applied_at  timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;`;

/**
 * Seed files run on every migrate, recorded or not. Their inserts are all
 * `on conflict do update`, so a copy edit in a seed reaches the database
 * without a new migration file.
 */
function isSeed(name) {
  return name.includes("_seed_");
}

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
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || fileEnv.SUPABASE_ACCESS_TOKEN;
const dry = process.argv.includes("--dry");

/** Posts one query and returns the rows. Throws with the Supabase message. */
async function query(sql) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
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

/** The migration files on disk, in the order they apply. */
function listMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

/** Names already recorded in the ledger, or an empty set when it does not exist yet. */
async function appliedNames() {
  const exists = await query(
    `select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'schema_migrations';`,
  );
  if (!Array.isArray(exists) || exists.length === 0) return new Set();
  const rows = await query(`select name from public.schema_migrations;`);
  return new Set((rows ?? []).map((row) => row.name));
}

async function main() {
  if (!TOKEN) {
    console.error("No SUPABASE_ACCESS_TOKEN found.\n");
    console.error("Put it in .env.local:\n");
    console.error("  SUPABASE_ACCESS_TOKEN=sbp_...\n");
    console.error("then run: npm run db:migrate");
    process.exit(1);
  }

  const files = listMigrations();
  if (files.length === 0) {
    console.log(`No .sql files in ${MIGRATIONS_DIR}`);
    return;
  }

  if (!dry) await query(CREATE_LEDGER);
  const applied = await appliedNames();

  console.log(`\nSupabase project ${PROJECT_REF}${dry ? " (dry run)" : ""}\n`);

  let pending = 0;
  for (const name of files) {
    const seed = isSeed(name);
    const rerun = seed && applied.has(name);
    if (applied.has(name) && !seed) {
      console.log(`  skipped   ${name}  (already applied)`);
      continue;
    }
    pending += 1;
    if (dry) {
      console.log(`  would run ${name}${rerun ? "  (seed, runs every time)" : ""}`);
      continue;
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, name), "utf8");
    // Recorded in the same request, so a failing file is never marked applied.
    const quoted = `'${name.replace(/'/g, "''")}'`;
    const record = seed
      ? `insert into public.schema_migrations (name) values (${quoted}) on conflict (name) do update set applied_at = now();`
      : `insert into public.schema_migrations (name) values (${quoted});`;
    try {
      await query(`${sql}\n\n${record}`);
      console.log(`  ${rerun ? "reran    " : "applied  "} ${name}`);
    } catch (err) {
      console.error(`  FAILED    ${name}\n`);
      console.error(`${err.message}\n`);
      process.exit(1);
    }
  }

  console.log("");
  if (pending === 0) console.log("Nothing to apply.");
  else if (dry) console.log(`${pending} file(s) would run.`);
  else console.log(`${pending} file(s) applied.`);
  console.log("");
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
