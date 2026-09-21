#!/usr/bin/env node
/**
 * Removes demo data or test data from the Supabase project and the R2 bucket.
 * Dry run by default: it prints what it would delete, per table, and deletes
 * nothing until --apply is given.
 *
 *   npm run db:purge -- --demo              what demo:seed made (accounts on demo.alttavia.invalid)
 *   npm run db:purge -- --tests             Stripe test mode orders, test clients' unpaid orders, the test clients
 *   npm run db:purge -- --demo --tests      both
 *   npm run db:purge -- --tests --apply     delete for real
 *   npm run db:purge -- --tests --i-know    also the unpaid orders it holds back (see below)
 *
 * Run `npm run db:dump` first when in doubt: deleted rows and files do not
 * come back any other way.
 *
 * --demo takes every account whose email ends in @demo.alttavia.invalid,
 * with all of its orders, whatever their state.
 *
 * --tests takes:
 *   - every order whose Stripe checkout session starts with cs_test_ (paid or
 *     not), whoever owns it: test mode never charges anyone;
 *   - every order with no session that was never paid, but only when its
 *     owner is in TEST_USER_EMAILS or is an admin. Anyone else's such order
 *     may be a real prospect who made an account and has not paid yet (live
 *     payments through a Payment Link carry no session until the webhook
 *     records them), so it is held back and listed. --i-know takes the held
 *     back orders too; read the dry run before passing it;
 *   - the accounts in TEST_USER_EMAILS below, once none of their orders is
 *     left after that. An account that still has an order this mode does not
 *     take (a live payment, say) is kept, and the report says so.
 *   Demo accounts are left to --demo.
 *
 * The report lists every order it takes, one line each: id, owner email,
 * service, created, paid or unpaid, session prefix and why. Then the orders
 * held back, then the counts per table.
 *
 * With every order go its events, uploaded documents, applicant details,
 * service agreement and deliverables (the database cascades them), its
 * answers (by submission), and its files in the bucket: everything under
 * orders/<id>/, deliverables/<id>/ and contracts/<id>/, plus any key a row
 * names. With every account go its remaining answers, its profile and its
 * auth user.
 *
 * Refusals:
 *   - an account whose role is admin is never deleted, whatever list it is
 *     on. Its test orders still go.
 *   - an account still named on rows that stay (the actor of an event, the
 *     reviewer of a document, the uploader of a deliverable on an order that
 *     is kept) is kept, and the report says so.
 *
 * Reads .env.local (the readEnvFile pattern of scripts/stripe-setup.mjs):
 * NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, and S3_ENDPOINT, S3_BUCKET,
 * S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (S3_REGION optional) for the files.
 * Prints the orders and accounts it names and the counts, never a key or a
 * secret.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

/**
 * Client accounts used for testing. Never an admin (an admin on this list is
 * skipped anyway). Add an address here only when every order on it is a test.
 */
const TEST_USER_EMAILS = ["business@guyshore.com", "guilhermekodenvis@gmail.com"];

const DEMO_DOMAIN = "demo.alttavia.invalid";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = 1000;
const CHUNK = 50;

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

const args = new Set(process.argv.slice(2));
const modeDemo = args.has("--demo");
const modeTests = args.has("--tests");
const apply = args.has("--apply");
const iKnow = args.has("--i-know");

function chunks(list, size = CHUNK) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function readAll(supabase, table, columns, filter) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select(columns).order("id", { ascending: true });
    if (filter) query = filter(query);
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

/** Rows of a child table that belong to any of the orders, read in chunks. */
async function readByOrders(supabase, table, columns, orderIds) {
  const rows = [];
  for (const part of chunks(orderIds)) {
    rows.push(...(await readAll(supabase, table, columns, (q) => q.in("user_service_id", part))));
  }
  return rows;
}

async function listAuthUsers(supabase) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`auth users: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) break;
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

async function listPrefix(s3, prefix) {
  const keys = [];
  let token;
  do {
    const page = await s3.client.send(
      new ListObjectsV2Command({ Bucket: s3.bucket, Prefix: prefix, ContinuationToken: token }),
    );
    for (const item of page.Contents ?? []) if (item.Key) keys.push(item.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

const lower = (value) => String(value ?? "").trim().toLowerCase();

async function main() {
  if (!modeDemo && !modeTests) {
    console.error("Choose what to purge: --demo, --tests, or both. Add --apply to delete for real.");
    process.exit(1);
  }
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SECRET_KEY");
  if (!url || !key) {
    console.error("Missing in .env.local: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const orders = await readAll(
    supabase,
    "user_services",
    "id, user_id, service_id, stripe_checkout_session_id, paid_at, submission_id, created_at",
  );
  const services = await readAll(supabase, "services", "id, slug");
  const slugById = new Map(services.map((s) => [s.id, s.slug]));

  const profiles = await readAll(supabase, "users", "id, email, role");
  const authUsers = await listAuthUsers(supabase);
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const isAdmin = (id) => profileById.get(id)?.role === "admin";
  const isDemoEmail = (email) => lower(email).endsWith(`@${DEMO_DOMAIN}`);
  const testEmails = new Set(TEST_USER_EMAILS.map(lower));

  // Accounts by email, from the profiles and from auth (a profile can be missing).
  const accounts = new Map();
  for (const p of profiles) accounts.set(p.id, { id: p.id, email: p.email, role: p.role ?? "client", auth: false });
  for (const u of authUsers) {
    const found = accounts.get(u.id);
    if (found) found.auth = true;
    else accounts.set(u.id, { id: u.id, email: u.email ?? "", role: "client", auth: true, noProfile: true });
  }

  const notes = [];
  const demoAccounts = new Set();
  const testAccounts = new Set();
  for (const account of accounts.values()) {
    const demo = modeDemo && isDemoEmail(account.email);
    const test = modeTests && testEmails.has(lower(account.email));
    if (!demo && !test) continue;
    if (account.role === "admin" || isAdmin(account.id)) {
      notes.push(`kept ${account.email}: role is admin`);
      continue;
    }
    if (demo) demoAccounts.add(account.id);
    else testAccounts.add(account.id);
  }

  // --- Orders ---------------------------------------------------------------
  const doomed = new Map(); // order id -> order
  const reasons = new Map(); // order id -> why it goes
  const heldBack = []; // sessionless unpaid orders of accounts that are not on a test list
  for (const order of orders) {
    if (demoAccounts.has(order.user_id)) {
      doomed.set(order.id, order);
      reasons.set(order.id, "demo account");
      continue;
    }
    if (!modeTests) continue;
    // Demo accounts belong to --demo, whether or not it was passed.
    const owner = profileById.get(order.user_id);
    if (owner && isDemoEmail(owner.email)) continue;
    const session = String(order.stripe_checkout_session_id ?? "");
    let reason = null;
    if (session.startsWith("cs_test_")) reason = "Stripe test session";
    else if (!session && !order.paid_at) {
      if (testAccounts.has(order.user_id)) reason = "test account, never paid";
      else if (isAdmin(order.user_id)) reason = "admin account, never paid";
      else if (iKnow) reason = "never paid, taken with --i-know";
      else heldBack.push(order);
    }
    if (reason) {
      doomed.set(order.id, order);
      reasons.set(order.id, reason);
    }
  }
  const orderIds = [...doomed.keys()];

  // --- Accounts that can go --------------------------------------------------
  const candidateIds = [...demoAccounts, ...testAccounts];
  const remaining = orders.filter((o) => !doomed.has(o.id));
  const remainingIds = remaining.map((o) => o.id);
  const [eventRefs, reviewRefs, uploadRefs] = await Promise.all([
    readByOrders(supabase, "user_service_events", "id, user_service_id, actor_id", remainingIds),
    readByOrders(supabase, "user_documents", "id, user_service_id, reviewed_by", remainingIds),
    readByOrders(supabase, "user_service_deliverables", "id, user_service_id, uploaded_by", remainingIds),
  ]);
  const usersToDelete = [];
  for (const id of candidateIds) {
    const account = accounts.get(id);
    const kept = remaining.filter((o) => o.user_id === id).length;
    if (kept > 0) {
      notes.push(`kept ${account.email}: ${kept} order(s) this mode does not take`);
      continue;
    }
    const named =
      eventRefs.some((r) => r.actor_id === id) ||
      reviewRefs.some((r) => r.reviewed_by === id) ||
      uploadRefs.some((r) => r.uploaded_by === id);
    if (named) {
      notes.push(`kept ${account.email}: named on rows of orders that stay`);
      continue;
    }
    usersToDelete.push(account);
  }
  const userIdsToDelete = usersToDelete.map((u) => u.id);

  // --- What goes with them -------------------------------------------------
  const [events, documents, applicants, contracts, deliverables] = await Promise.all([
    readByOrders(supabase, "user_service_events", "id", orderIds),
    readByOrders(supabase, "user_documents", "id, storage_key", orderIds),
    readByOrders(supabase, "user_service_applicants", "id", orderIds),
    readByOrders(supabase, "user_service_contracts", "id, storage_key", orderIds),
    readByOrders(supabase, "user_service_deliverables", "id, storage_key", orderIds),
  ]);
  const submissionIds = [...new Set([...doomed.values()].map((o) => o.submission_id).filter(Boolean))];
  const answerIds = new Set();
  for (const part of chunks(submissionIds)) {
    for (const row of await readAll(supabase, "user_answers", "id", (q) => q.in("submission_id", part))) {
      answerIds.add(row.id);
    }
  }
  for (const part of chunks(userIdsToDelete)) {
    for (const row of await readAll(supabase, "user_answers", "id", (q) => q.in("user_id", part))) {
      answerIds.add(row.id);
    }
  }

  // --- Files ------------------------------------------------------------------
  const s3 = s3FromEnv();
  const fileKeys = new Set(
    [...documents, ...contracts, ...deliverables].map((row) => row.storage_key).filter(Boolean),
  );
  if (s3) {
    for (const id of orderIds) {
      for (const prefix of [`orders/${id}/`, `deliverables/${id}/`, `contracts/${id}/`]) {
        for (const found of await listPrefix(s3, prefix)) fileKeys.add(found);
      }
    }
  } else {
    notes.push("S3_* variables missing: bucket files are counted from the rows only and cannot be deleted");
  }

  // --- Report -----------------------------------------------------------------
  const modes = [modeDemo && "--demo", modeTests && "--tests"].filter(Boolean).join(" ");
  console.log(`\n${apply ? "PURGE" : "Dry run"} ${modes} on ${new URL(url).host}\n`);
  const orderLine = (order) => {
    const session = String(order.stripe_checkout_session_id ?? "");
    return [
      order.id,
      accounts.get(order.user_id)?.email || "(no account)",
      slugById.get(order.service_id) ?? "(unknown service)",
      String(order.created_at ?? "").slice(0, 10),
      order.paid_at ? "paid" : "unpaid",
      session ? session.slice(0, 8) : "no session",
    ].join("  ");
  };
  console.log(`  orders to delete: ${doomed.size}`);
  for (const order of doomed.values()) console.log(`    ${orderLine(order)}  ${reasons.get(order.id)}`);
  if (heldBack.length) {
    console.log(`\n  held back: ${heldBack.length} unpaid order(s) with no session, of accounts on no test list.`);
    console.log("  They may be real prospects. --i-know takes them too.");
    for (const order of heldBack) console.log(`    ${orderLine(order)}`);
  }
  console.log("");
  const counts = [
    ["user_services", orderIds.length],
    ["user_service_events", events.length],
    ["user_documents", documents.length],
    ["user_service_applicants", applicants.length],
    ["user_service_contracts", contracts.length],
    ["user_service_deliverables", deliverables.length],
    ["user_answers", answerIds.size],
    ["users (profiles)", usersToDelete.filter((u) => !u.noProfile).length],
    ["auth users", usersToDelete.filter((u) => u.auth).length],
    ["bucket objects", fileKeys.size],
  ];
  for (const [label, count] of counts) console.log(`  ${label.padEnd(28)} ${String(count).padStart(6)}`);
  if (usersToDelete.length) {
    console.log("\n  accounts:");
    for (const account of usersToDelete) console.log(`    ${account.email}`);
  }
  if (notes.length) {
    console.log("\n  notes:");
    for (const note of notes) console.log(`    ${note}`);
  }

  if (!apply) {
    console.log("\nNothing was deleted. Add --apply to delete.\n");
    return;
  }

  // --- Apply: orders (the database cascades their children), answers, files, accounts
  for (const part of chunks(orderIds)) {
    const { error } = await supabase.from("user_services").delete().in("id", part);
    if (error) throw new Error(`user_services: ${error.message}`);
  }
  for (const part of chunks([...answerIds])) {
    const { error } = await supabase.from("user_answers").delete().in("id", part);
    if (error) throw new Error(`user_answers: ${error.message}`);
  }
  let filesDeleted = 0;
  if (s3) {
    for (const fileKey of fileKeys) {
      await s3.client.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: fileKey }));
      filesDeleted += 1;
    }
  }
  let accountsDeleted = 0;
  for (const account of usersToDelete) {
    if (isAdmin(account.id)) continue; // belt and braces: never an admin
    if (account.auth) {
      // Deleting the auth user cascades to the profile (public.users references auth.users).
      const { error } = await supabase.auth.admin.deleteUser(account.id);
      if (error) throw new Error(`auth user ${account.email}: ${error.message}`);
    } else {
      const { error } = await supabase.from("users").delete().eq("id", account.id);
      if (error) throw new Error(`users ${account.email}: ${error.message}`);
    }
    accountsDeleted += 1;
  }
  console.log(`\nDeleted ${orderIds.length} order(s), ${answerIds.size} answer(s), ${filesDeleted} file(s), ${accountsDeleted} account(s).\n`);
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
