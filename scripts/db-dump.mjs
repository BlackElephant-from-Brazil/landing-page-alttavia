#!/usr/bin/env node
/**
 * A backup of the Supabase project, written outside the repository.
 *
 *   npm run db:dump                    tables and auth users
 *   npm run db:dump -- --with-files    the same, plus every object in the R2 bucket
 *
 * It writes one folder per run, named by the time it started, under
 * %USERPROFILE%\alttavia-backups\ (created when missing):
 *
 *   2026-09-21T14-05-33Z/
 *     manifest.json          what is in the folder: tables, row counts, primary
 *                            keys, auth users, files; db:restore reads this
 *     tables/<table>.json    every row of one public table, as PostgREST returns it
 *     auth-users.json        every auth user as the Auth admin API returns it
 *     files/<key>            with --with-files, every object under its own key
 *
 * The folder holds personal data (emails, passport details, uploaded
 * passports with --with-files). Keep it on this machine or somewhere as
 * private as the database itself, and delete old ones.
 *
 * How it reads:
 *
 *   - Tables are discovered from PostgREST's own description of the API (the
 *     OpenAPI document at /rest/v1/, readable with the secret key), so a table
 *     added by a later migration is dumped without editing this file. Views
 *     (admin_order_summary) are listed in the manifest and skipped: they hold
 *     no data of their own. When the description cannot be read, a fixed list
 *     of the known tables is used instead.
 *   - Rows are read with the secret key (row level security does not apply to
 *     it), 1000 at a time, ordered by the primary key so no row is read twice
 *     or missed.
 *   - Auth users come from auth.admin.listUsers, a page at a time. Password
 *     hashes are not part of that API, so a restore can never recreate a
 *     password; see scripts/db-restore.mjs.
 *   - Files are listed with ListObjectsV2 and downloaded one by one.
 *
 * It only reads: nothing in the project or the bucket is changed. It prints
 * counts and the folder path, never a row, an email or a key.
 *
 * Reads .env.local (the readEnvFile pattern of scripts/stripe-setup.mjs):
 * NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, and for --with-files
 * S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (S3_REGION
 * optional). An explicit environment variable wins over the file.
 * ALTTAVIA_BACKUP_DIR overrides the parent folder.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_REF = "dgdbrnvgrpixsslgvmns";
const PAGE = 1000;

/** Used only when the API description cannot be read. Order does not matter here. */
const KNOWN_TABLES = [
  "users",
  "questions",
  "services",
  "service_stages",
  "service_docs",
  "service_deliverables",
  "user_answers",
  "user_services",
  "user_service_events",
  "user_documents",
  "user_service_deliverables",
  "user_service_applicants",
  "user_service_contracts",
  "admin_feedback",
  "schema_migrations",
];
const KNOWN_PRIMARY_KEYS = { schema_migrations: ["name"] };

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

const withFiles = process.argv.includes("--with-files");

/** 2026-09-21T14-05-33Z: sortable, and legal in a Windows folder name. */
function stamp(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "-");
}

function backupRoot() {
  return env("ALTTAVIA_BACKUP_DIR") || join(process.env.USERPROFILE || homedir(), "alttavia-backups");
}

/**
 * Tables, views and primary keys from PostgREST's OpenAPI document. A path
 * that accepts POST or DELETE is a table; a path that only reads is a view.
 * Primary key columns carry "<pk/>" in their description.
 */
async function describeApi(url, key) {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Accept: "application/openapi+json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const spec = await res.json();
  const tables = [];
  const views = [];
  for (const [path, ops] of Object.entries(spec.paths ?? {})) {
    const name = path.replace(/^\//, "");
    if (!name || name.startsWith("rpc/")) continue;
    if (ops.post || ops.delete) tables.push(name);
    else views.push(name);
  }
  const primaryKeys = {};
  for (const name of tables) {
    const props = spec.definitions?.[name]?.properties ?? {};
    primaryKeys[name] = Object.entries(props)
      .filter(([, prop]) => typeof prop.description === "string" && prop.description.includes("<pk/>"))
      .map(([column]) => column);
  }
  return { tables: tables.sort(), views: views.sort(), primaryKeys };
}

/** Every row of one table, a page at a time, in primary key order. */
async function readTable(supabase, table, orderBy) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select("*");
    for (const column of orderBy) query = query.order(column, { ascending: true });
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

/** Every auth user, a page at a time. */
async function readAuthUsers(supabase) {
  const users = [];
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`auth users: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < perPage) break;
  }
  return users;
}

function s3FromEnv() {
  const endpoint = env("S3_ENDPOINT");
  const bucket = env("S3_BUCKET");
  const accessKeyId = env("S3_ACCESS_KEY_ID");
  const secretAccessKey = env("S3_SECRET_ACCESS_KEY");
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  const client = new S3Client({
    endpoint,
    region: env("S3_REGION") || "auto",
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return { client, bucket };
}

/** A key as a relative path Windows accepts: no drive letters, no reserved characters, no "..". */
function safeRelativePath(key) {
  return key
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .map((part) => part.replace(/[<>:"\\|?*\u0000-\u001f]/g, "_"))
    .join("/");
}

async function dumpFiles(folder) {
  const s3 = s3FromEnv();
  if (!s3) throw new Error("--with-files needs S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
  const filesDir = join(folder, "files");
  mkdirSync(filesDir, { recursive: true });
  let objects = 0;
  let bytes = 0;
  const index = [];
  let token;
  do {
    const page = await s3.client.send(
      new ListObjectsV2Command({ Bucket: s3.bucket, ContinuationToken: token, MaxKeys: 1000 }),
    );
    for (const item of page.Contents ?? []) {
      if (!item.Key || item.Key.endsWith("/")) continue;
      const found = await s3.client.send(new GetObjectCommand({ Bucket: s3.bucket, Key: item.Key }));
      const body = found.Body ? await found.Body.transformToByteArray() : new Uint8Array();
      const relative = safeRelativePath(item.Key);
      const target = join(filesDir, ...relative.split("/"));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, body);
      index.push({ key: item.Key, path: `files/${relative}`, size: body.byteLength, contentType: found.ContentType ?? null });
      objects += 1;
      bytes += body.byteLength;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  writeFileSync(join(folder, "files-index.json"), JSON.stringify(index, null, 2));
  return { dir: "files", index: "files-index.json", objects, bytes };
}

async function main() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SECRET_KEY");
  if (!url || !key) {
    console.error("Missing in .env.local: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const startedAt = new Date();
  const folder = join(backupRoot(), stamp(startedAt));
  mkdirSync(join(folder, "tables"), { recursive: true });

  let described;
  try {
    described = await describeApi(url.replace(/\/+$/, ""), key);
  } catch (error) {
    console.warn(`  ! Could not read the API description (${error.message}); using the known table list.`);
    described = { tables: KNOWN_TABLES, views: [], primaryKeys: KNOWN_PRIMARY_KEYS };
  }

  console.log(`\nDumping ${new URL(url).host}\n`);
  const tables = [];
  for (const table of described.tables) {
    const pk = described.primaryKeys[table]?.length ? described.primaryKeys[table] : ["id"];
    let rows;
    try {
      rows = await readTable(supabase, table, pk);
    } catch (error) {
      // A table without an id column and no primary key in the description: read it in natural order.
      if (/column .* does not exist/i.test(error.message)) rows = await readTable(supabase, table, []);
      else throw error;
    }
    const file = `tables/${table}.json`;
    writeFileSync(join(folder, ...file.split("/")), JSON.stringify(rows, null, 2));
    tables.push({ name: table, file, rows: rows.length, primaryKey: pk });
    console.log(`  ${table.padEnd(28)} ${String(rows.length).padStart(6)}`);
  }

  const authUsers = await readAuthUsers(supabase);
  writeFileSync(join(folder, "auth-users.json"), JSON.stringify(authUsers, null, 2));
  console.log(`  ${"auth users".padEnd(28)} ${String(authUsers.length).padStart(6)}`);

  let files = null;
  if (withFiles) {
    files = await dumpFiles(folder);
    console.log(`  ${"bucket objects".padEnd(28)} ${String(files.objects).padStart(6)}  (${files.bytes} bytes)`);
  }

  const manifest = {
    tool: "scripts/db-dump.mjs",
    format: 1,
    createdAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    projectRef: PROJECT_REF,
    supabaseHost: new URL(url).host,
    tables,
    views: described.views,
    auth: { file: "auth-users.json", users: authUsers.length },
    files,
  };
  writeFileSync(join(folder, "manifest.json"), JSON.stringify(manifest, null, 2));

  const total = tables.reduce((sum, t) => sum + t.rows, 0);
  console.log(`\n${tables.length} tables, ${total} rows, ${authUsers.length} auth users${files ? `, ${files.objects} files` : ""}.`);
  if (described.views.length) console.log(`Views skipped: ${described.views.join(", ")}.`);
  console.log(`\nWritten to ${folder}\n`);
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
