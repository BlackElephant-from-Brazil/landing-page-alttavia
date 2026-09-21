#!/usr/bin/env node
/**
 * Puts the rows of a db:dump folder back into the configured Supabase project.
 *
 *   npm run db:restore -- <dump folder>          dry run: what would be written, in which order
 *   npm run db:restore -- --latest               the same, with the newest folder under alttavia-backups
 *   npm run db:restore -- <folder> --apply       insert the rows the target is missing, for real
 *   npm run db:restore -- <folder> --apply --overwrite   also overwrite rows that exist (read below first)
 *   npm run db:restore -- <folder> --apply --replace-catalogue
 *
 * RESTORING AUTH USERS IS NOT SUPPORTED. The Auth admin API gives no password
 * hashes and no way to set a user's id, so this script never creates,
 * changes or deletes an auth user, and auth-users.json in the dump is read
 * only to report. A profile (public.users) is restored only when an auth user
 * with the same id already exists in the target project; the others are
 * skipped, and so is everything that hangs on them (their answers, their
 * orders and each order's events, documents, details, agreement and
 * deliverables). A reference to a skipped user that is only a trace (the
 * actor of an event, the reviewer of a document) is set to null instead.
 *
 * Files are not restored either: a dump made with --with-files keeps them
 * under files/ with files-index.json, to be uploaded back by hand if a bucket
 * is ever lost.
 *
 * Order, parents before children, so every foreign key finds its row:
 *
 *   questions, services, service_stages, service_docs, service_deliverables,
 *   users, user_answers, user_services, user_service_events, user_documents,
 *   user_service_deliverables, user_service_applicants, user_service_contracts,
 *   admin_feedback, then any table this list does not know yet.
 *
 * schema_migrations is never restored: the ledger must describe the schema
 * the target really has, which is db:migrate's job. Run `npm run db:migrate`
 * on a new project first, then this.
 *
 * Two modes, keyed on each row's primary key (questions on `key`, which
 * user_answers points at). Neither ever deletes a row, and running either
 * twice changes nothing more.
 *
 *   default      inserts only the rows the target is missing; a row that
 *                exists is left exactly as it is. This is the safe restore
 *                after an accident (a purge that took too much): what was
 *                deleted comes back, and nothing that changed since the dump
 *                is rolled back.
 *   --overwrite  also overwrites every existing row with the dump's values.
 *                On the project the dump came from (the only useful target
 *                for client data, see above) that rolls back everything
 *                changed since the dump: a paid order goes back to unpaid
 *                with no session, so the client sees Pay again; stage moves
 *                and document reviews revert. `users.role` is never written
 *                in this mode, so no one gains or loses admin. updated_at is
 *                set to now on every overwritten row (the shared trigger).
 *
 * The dry run says which mode would run.
 *
 * The catalogue check: db:migrate seeds services with random ids, so a new
 * project already has a "nif-only" whose id differs from the dump's, and the
 * upsert would break on the unique slug. The dry run lists those services;
 * --apply refuses while there are any, unless --replace-catalogue is given,
 * which deletes the target's conflicting services (with their stages,
 * document slots and deliverable templates) before the rows go in, and only when
 * no order points at them.
 *
 * Reads .env.local (the readEnvFile pattern of scripts/stripe-setup.mjs):
 * NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY, the project the rows go
 * to. Prints table names and counts only.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BATCH = 500;

/** Restore order. Tables in a dump but not here go last, in the dump's order. */
const ORDER = [
  "questions",
  "services",
  "service_stages",
  "service_docs",
  "service_deliverables",
  "users",
  "user_answers",
  "user_services",
  "user_service_events",
  "user_documents",
  "user_service_deliverables",
  "user_service_applicants",
  "user_service_contracts",
  "admin_feedback",
];
const NEVER = new Set(["schema_migrations"]);
const CONFLICT_COLUMN = { questions: "key" };

/**
 * Columns that point at a user or an order. `skip` drops the row when its
 * parent was skipped; `null` keeps the row and clears the reference.
 */
const USER_REFS = {
  user_answers: { user_id: "skip" },
  user_services: { user_id: "skip" },
  user_service_events: { actor_id: "null" },
  user_documents: { reviewed_by: "null" },
  user_service_deliverables: { uploaded_by: "null" },
  admin_feedback: { user_id: "null" },
};
const ORDER_CHILDREN = new Set([
  "user_service_events",
  "user_documents",
  "user_service_deliverables",
  "user_service_applicants",
  "user_service_contracts",
]);

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

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const replaceCatalogue = args.includes("--replace-catalogue");
const overwrite = args.includes("--overwrite");
const latest = args.includes("--latest");
const folderArg = args.find((arg) => !arg.startsWith("--"));

function backupRoot() {
  return env("ALTTAVIA_BACKUP_DIR") || join(process.env.USERPROFILE || homedir(), "alttavia-backups");
}

function resolveFolder() {
  if (folderArg) return resolve(folderArg);
  if (latest) {
    const root = backupRoot();
    const names = existsSync(root)
      ? readdirSync(root).filter((name) => existsSync(join(root, name, "manifest.json"))).sort()
      : [];
    if (names.length === 0) throw new Error(`No dump folder under ${root}. Run npm run db:dump first.`);
    return join(root, names[names.length - 1]);
  }
  throw new Error("Name a dump folder, or pass --latest.\n\n  npm run db:restore -- --latest");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

async function check(label, promise) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

/** Every auth user id in the target project. */
async function targetAuthIds(supabase) {
  const ids = new Set();
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`auth users: ${error.message}`);
    for (const user of data.users) ids.add(user.id);
    if (data.users.length < 1000) break;
  }
  return ids;
}

async function main() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SECRET_KEY");
  if (!url || !key) {
    console.error("Missing in .env.local: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
    process.exit(1);
  }
  const folder = resolveFolder();
  if (!existsSync(join(folder, "manifest.json")) || !statSync(folder).isDirectory()) {
    throw new Error(`${folder} is not a db:dump folder (no manifest.json).`);
  }
  const manifest = readJson(join(folder, "manifest.json"));
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const targetHost = new URL(url).host;

  console.log(`\n${apply ? "RESTORE" : "Dry run"}: ${folder}`);
  console.log(`  dumped from ${manifest.supabaseHost} at ${manifest.createdAt}`);
  console.log(`  target      ${targetHost}${manifest.supabaseHost === targetHost ? " (same project)" : " (a DIFFERENT project)"}`);
  console.log(
    overwrite
      ? "  mode        --overwrite: missing rows are inserted and EXISTING rows are overwritten with the dump's\n" +
          "              values, rolling back every change made since the dump (users.role is never written)"
      : "  mode        insert only: missing rows are inserted, existing rows are left as they are",
  );
  console.log("  auth users are not restored; see the header of this script\n");

  // --- Load the dump ---------------------------------------------------------
  const byName = new Map(manifest.tables.map((t) => [t.name, t]));
  const names = [
    ...ORDER.filter((name) => byName.has(name)),
    ...manifest.tables.map((t) => t.name).filter((name) => !ORDER.includes(name) && !NEVER.has(name)),
  ];
  const data = new Map();
  for (const name of names) data.set(name, readJson(join(folder, ...byName.get(name).file.split("/"))));

  // --- Users without an auth user, and everything hanging on them ------------
  const authIds = await targetAuthIds(supabase);
  const skippedUsers = new Set((data.get("users") ?? []).filter((u) => !authIds.has(u.id)).map((u) => u.id));
  const skippedOrders = new Set(
    (data.get("user_services") ?? []).filter((o) => skippedUsers.has(o.user_id)).map((o) => o.id),
  );

  const plan = [];
  for (const name of names) {
    const refs = USER_REFS[name] ?? {};
    let skipped = 0;
    let cleared = 0;
    const rows = [];
    for (const original of data.get(name)) {
      if (name === "users" && skippedUsers.has(original.id)) {
        skipped += 1;
        continue;
      }
      if (ORDER_CHILDREN.has(name) && skippedOrders.has(original.user_service_id)) {
        skipped += 1;
        continue;
      }
      let row = original;
      let drop = false;
      for (const [column, rule] of Object.entries(refs)) {
        if (!row[column] || !skippedUsers.has(row[column])) continue;
        if (rule === "skip") drop = true;
        else {
          row = { ...row, [column]: null };
          cleared += 1;
        }
      }
      if (drop) {
        skipped += 1;
        continue;
      }
      // Overwriting never rewrites who is an admin; a profile inserted without it gets the default, client.
      if (overwrite && name === "users" && "role" in row) {
        const { role: _role, ...rest } = row;
        row = rest;
      }
      rows.push(row);
    }
    const pk = byName.get(name).primaryKey?.length ? byName.get(name).primaryKey : ["id"];
    plan.push({ name, rows, skipped, cleared, onConflict: CONFLICT_COLUMN[name] ?? pk.join(",") });
  }

  // --- Catalogue conflicts ---------------------------------------------------
  const dumpServices = data.get("services") ?? [];
  const targetServices = await check("services", supabase.from("services").select("id, slug"));
  const conflicts = targetServices.filter((t) => dumpServices.some((d) => d.slug === t.slug && d.id !== t.id));

  // --- Report ----------------------------------------------------------------
  console.log("  order  table                            rows  skipped  refs cleared  on conflict");
  plan.forEach((step, i) => {
    console.log(
      `  ${String(i + 1).padStart(5)}  ${step.name.padEnd(30)} ${String(step.rows.length).padStart(6)}  ` +
        `${String(step.skipped).padStart(7)}  ${String(step.cleared).padStart(12)}  ${step.onConflict}`,
    );
  });
  const never = manifest.tables.filter((t) => NEVER.has(t.name)).map((t) => t.name);
  if (never.length) console.log(`\n  not restored: ${never.join(", ")} (run db:migrate on the target instead)`);
  if (skippedUsers.size) {
    console.log(`\n  ${skippedUsers.size} profile(s) have no auth user in the target and are skipped with their data.`);
  }
  if (conflicts.length) {
    console.log(
      `\n  ${conflicts.length} service(s) in the target share a slug with the dump under another id: ` +
        conflicts.map((c) => c.slug).join(", "),
    );
    console.log("  --apply refuses until --replace-catalogue is given (see the header).");
  }

  if (!apply) {
    console.log("\nNothing was written. Add --apply to restore.\n");
    return;
  }

  // --- Apply -----------------------------------------------------------------
  if (conflicts.length) {
    if (!replaceCatalogue) {
      console.error("\nRefused: catalogue conflicts. Re-run with --replace-catalogue if the target's services may go.\n");
      process.exit(1);
    }
    for (const service of conflicts) {
      const { count, error } = await supabase
        .from("user_services")
        .select("id", { count: "exact", head: true })
        .eq("service_id", service.id);
      if (error) throw new Error(`user_services: ${error.message}`);
      if (count) {
        console.error(`\nRefused: ${count} order(s) in the target use service ${service.slug}; it cannot be replaced.\n`);
        process.exit(1);
      }
    }
    for (const service of conflicts) {
      await check(`delete service ${service.slug}`, supabase.from("services").delete().eq("id", service.id));
    }
    console.log(`\n  replaced ${conflicts.length} seeded service(s)`);
  }

  console.log("");
  for (const step of plan) {
    let written = 0;
    for (let i = 0; i < step.rows.length; i += BATCH) {
      const batch = step.rows.slice(i, i + BATCH);
      // Insert only: ON CONFLICT DO NOTHING, and the answer holds the rows that went in.
      const data = await check(
        step.name,
        supabase
          .from(step.name)
          .upsert(batch, { onConflict: step.onConflict, ignoreDuplicates: !overwrite })
          .select(step.onConflict),
      );
      written += data?.length ?? 0;
    }
    console.log(
      overwrite
        ? `  written  ${step.name.padEnd(30)} ${step.rows.length}`
        : `  inserted ${step.name.padEnd(30)} ${String(written).padStart(6)} of ${step.rows.length} (the others exist and were left alone)`,
    );
  }
  console.log("\nDone. Auth users and files were not touched.\n");
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
