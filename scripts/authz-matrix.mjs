#!/usr/bin/env node
/**
 * Who can reach what: every route under src/app/api, called as each kind of
 * caller, against a running server. Prints a table (route x role x status)
 * and exits non zero when a client reaches another client's data or a
 * request without a session reaches any.
 *
 *   npm run authz:matrix                                  against http://localhost:3000
 *   npm run authz:matrix -- --base http://localhost:3000  the same, spelled out
 *
 * Needs the demo data (`npm run demo:seed`): the two client columns act as
 * ana@demo.alttavia.invalid, on her own orders (own) and on
 * ben@demo.alttavia.invalid's (other). Columns:
 *
 *   anon       no cookie at all
 *   own        Ana, on Ana's rows
 *   other      Ana, on Ben's rows
 *   admin      the support admin (ADMIN_SUPPORT_EMAIL and ADMIN_SUPPORT_PASSWORD
 *              in .env.local, see `npm run admin:create -- --support`),
 *              signed in with the password. Skipped with a warning when the two
 *              variables are missing.
 *   admin-code the same admin account with a session from an emailed code
 *              instead of the password: the admin area must treat it as a
 *              client (src/lib/supabase/admin-user.ts).
 *
 * After the routes, the same two admin sessions go straight to PostgREST with
 * the publishable key, the way anyone holding the token could, and read the
 * tables RLS guards (0011_admin_password_session.sql). The code session must
 * see only the admin account's own rows: anything more is a LEAK, since the
 * app treats that session as a client. The password session must see other
 * accounts' rows, or the admin pages (which read through RLS) go blank: warn.
 * A table the project does not have yet (a migration not applied) is noted.
 *
 * Routes are discovered from the file tree (route.ts files, with the methods
 * each one exports), so a route added later is called too. Known routes have
 * a probe written for them below; an unknown one gets a generic probe (its
 * dynamic segments filled with Ana's or Ben's ids, a body that is not JSON)
 * and is listed so a probe can be added.
 *
 * Nothing live is changed. Every probe is chosen so that it either reads, or
 * stops on a check before any write, or writes only to the demo accounts'
 * own orders (the one write on purpose: Ana's applicant details, sent back
 * with the values they already hold). Admin probes that could write carry a
 * body the route refuses, or target a demo order the route refuses to act
 * on, and never touch the catalogue, the admin's password or a real order.
 * The admin column never calls sign out, which would end that account's
 * sessions everywhere. Ana's own sign out runs last, since it ends her
 * sessions. The sessions opened here are closed at the end.
 *
 * Sessions are built server side and handed to the server as cookies, the
 * way @supabase/ssr stores them: sb-<ref>-auth-token, value "base64-" plus
 * the base64url JSON of the session, split into .0, .1, ... past 3180
 * characters. Clients: auth.admin.generateLink (magiclink, which sends no
 * email) then verifyOtp with its token hash. Admin: signInWithPassword.
 * Tokens and presigned URLs are never printed.
 *
 * How a cell reads: the HTTP status, then
 *   (nothing)  as expected
 *   LEAK       2xx or a redirect that is not to a login page, where the
 *              caller must be refused: anon (except public routes), other,
 *              and a client on /api/admin/*. Makes the exit code 1.
 *   warn       got past the access check to a validation error where it
 *              should have been refused, or a 5xx; read the findings
 *   ?          not what the probe expected, still a refusal
 *   skip / -   not called on purpose / no such case for this route
 *
 * Reads .env.local (the readEnvFile pattern of scripts/stripe-setup.mjs):
 * NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
 * SUPABASE_SECRET_KEY, and optionally ADMIN_SUPPORT_EMAIL and
 * ADMIN_SUPPORT_PASSWORD.
 */

import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

import { createClient } from "@supabase/supabase-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API_DIR = join(ROOT, "src", "app", "api");
const DEMO_DOMAIN = "demo.alttavia.invalid";
const OWN_EMAIL = `ana@${DEMO_DOMAIN}`;
const OTHER_EMAIL = `ben@${DEMO_DOMAIN}`;
const CHUNK_SIZE = 3180;
const REQUEST_TIMEOUT_MS = 120_000;

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

function argValue(name, fallback) {
  const args = process.argv.slice(2);
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  const inline = args.find((a) => a.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

const BASE = argValue("--base", "http://localhost:3000").replace(/\/+$/, "");

// ---------------------------------------------------------------------------
// Route discovery
// ---------------------------------------------------------------------------

const METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      // Folders starting with an underscore are private in the App Router.
      if (!name.startsWith("_")) out.push(...walk(full));
    } else if (/^route\.(ts|tsx|js|mjs)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function exportedMethods(source) {
  const found = new Set();
  for (const m of source.matchAll(/export\s+(?:async\s+)?function\s+([A-Z]+)\b/g)) found.add(m[1]);
  for (const m of source.matchAll(/export\s+(?:const|let|var)\s+([A-Z]+)\s*=/g)) found.add(m[1]);
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) found.add(name);
    }
  }
  return METHODS.filter((method) => found.has(method));
}

function discoverRoutes() {
  const routes = [];
  for (const file of walk(API_DIR)) {
    const segments = relative(join(ROOT, "src", "app"), dirname(file))
      .split(sep)
      .filter((segment) => !/^\(.*\)$/.test(segment)); // route groups do not reach the URL
    const path = `/${segments.join("/")}`;
    for (const method of exportedMethods(readFileSync(file, "utf8"))) routes.push({ method, path });
  }
  return routes.sort((a, b) => (a.path === b.path ? METHODS.indexOf(a.method) - METHODS.indexOf(b.method) : a.path.localeCompare(b.path)));
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

function authClient(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** The cookie header @supabase/ssr would read this session from. */
function sessionCookie(supabaseUrl, session) {
  const name = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
  if (value.length <= CHUNK_SIZE) return `${name}=${value}`;
  const parts = [];
  for (let i = 0; i * CHUNK_SIZE < value.length; i += 1) {
    parts.push(`${name}.${i}=${value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)}`);
  }
  return parts.join("; ");
}

/** A session from a magic link token, the way an emailed code signs a client in. No email is sent. */
async function codeSession(admin, publicClient, email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`generateLink for ${email}: ${error.message}`);
  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) throw new Error(`generateLink for ${email} returned no token`);
  let verified = await publicClient.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (verified.error) verified = await publicClient.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  if (verified.error || !verified.data.session) {
    throw new Error(`verifyOtp for ${email}: ${verified.error?.message ?? "no session"}`);
  }
  return verified.data.session;
}

// ---------------------------------------------------------------------------
// Fixtures: ids from the demo data
// ---------------------------------------------------------------------------

async function rowsOf(admin, table, column, values) {
  if (values.length === 0) return [];
  const { data, error } = await admin.from(table).select("*").in(column, values);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function fixturesFor(admin, email) {
  const { data: profile, error } = await admin.from("users").select("id, email, role").eq("email", email).maybeSingle();
  if (error) throw new Error(`users: ${error.message}`);
  if (!profile) return null;
  const orders = await rowsOf(admin, "user_services", "user_id", [profile.id]);
  const ids = orders.map((o) => o.id);
  const [documents, deliverables, contracts, applicants] = await Promise.all([
    rowsOf(admin, "user_documents", "user_service_id", ids),
    rowsOf(admin, "user_service_deliverables", "user_service_id", ids),
    rowsOf(admin, "user_service_contracts", "user_service_id", ids),
    rowsOf(admin, "user_service_applicants", "user_service_id", ids),
  ]);
  const serviceDocs = await rowsOf(admin, "service_docs", "service_id", [...new Set(orders.map((o) => o.service_id))]);

  const hasApplicant = (order) => applicants.some((a) => a.user_service_id === order.id && a.applicant_index === 0);
  const paid = orders.filter((o) => o.paid_at && !o.completed_at);
  const paidOrder = paid.find(hasApplicant) ?? paid[0] ?? orders.find((o) => o.paid_at) ?? null;
  const contract = contracts.find((c) => c.emailed_at) ?? contracts[0] ?? null;
  const live = documents.filter((d) => d.status !== "pending");
  return {
    userId: profile.id,
    role: profile.role,
    paidOrder,
    unpaidOrder: orders.find((o) => !o.paid_at) ?? null,
    contractOrder: contract ? orders.find((o) => o.id === contract.user_service_id) : null,
    document: live.find((d) => d.status === "uploaded") ?? live[0] ?? null,
    deliverable: deliverables.find((d) => d.status === "ready") ?? null,
    deedDoc: paidOrder ? serviceDocs.find((d) => d.service_id === paidOrder.service_id && d.template) ?? null : null,
    applicant: paidOrder ? applicants.find((a) => a.user_service_id === paidOrder.id && a.applicant_index === 0) ?? null : null,
    serviceId: paidOrder?.service_id ?? orders[0]?.service_id ?? null,
  };
}

const APPLICANT_FIELDS = [
  "full_name",
  "gender",
  "birth_place",
  "birth_date",
  "passport_number",
  "passport_issuer",
  "passport_issued_on",
  "passport_expires_on",
  "tax_address",
];

function applicantBody(row) {
  if (!row) return RAW;
  return json(Object.fromEntries(APPLICANT_FIELDS.map((field) => [field, row[field]])));
}

// ---------------------------------------------------------------------------
// Probes
// ---------------------------------------------------------------------------

/** Client routes that take the order or document they act on in the body rather than the path. */
const BODY_NAMES_AN_ORDER = new Set(["POST /api/checkout", "POST /api/documents/confirm", "POST /api/documents/upload-url"]);

/** A body that is not JSON: every route that reads one refuses it before acting. */
const RAW = { body: "authz-matrix probe, not JSON", type: "application/json" };
const json = (value) => ({ body: JSON.stringify(value), type: "application/json" });
const NONE = {};

/**
 * One entry per known route. `own`, `other`, `admin` (and `anon`, which
 * defaults to `own`) return { path, body?, type?, expect } or null for "no
 * such case". `expect` lists statuses or the words login (a redirect to a
 * login page) and redirect (any other redirect). `adminCode` defaults to the
 * admin probe. `public` routes may answer a caller without a session.
 */
function knownProbes(fx) {
  const A = fx.own;
  const B = fx.other;
  const id = (row) => row?.id ?? fx.missing;
  // Admin routes: every caller but the admin is refused (anon 401, clients 403, set in main()), so only the paths differ.
  const adminRoute = (options) => options;

  return {
    // --- Client routes -----------------------------------------------------
    "POST /api/apply/submit": {
      own: () => ({ path: "/api/apply/submit", ...json({ answers: {} }), expect: [422] }),
      anon: () => ({ path: "/api/apply/submit", ...json({ answers: {} }), expect: [401] }),
      other: null,
      admin: () => ({ path: "/api/apply/submit", ...json({ answers: {} }), expect: [422] }),
    },
    "POST /api/auth/signout": {
      public: true,
      last: true,
      own: () => ({ path: "/api/auth/signout", ...NONE, expect: [303] }),
      anon: () => ({ path: "/api/auth/signout", ...NONE, expect: [303] }),
      other: null,
      admin: "skip: would end the admin's sessions everywhere",
    },
    "POST /api/checkout": {
      own: () => ({ path: "/api/checkout", ...json({ userServiceId: id(A.paidOrder) }), expect: [409] }),
      anon: () => ({ path: "/api/checkout", ...json({ userServiceId: id(A.paidOrder) }), expect: [401] }),
      other: () => ({ path: "/api/checkout", ...json({ userServiceId: id(B.paidOrder) }), expect: [403] }),
      admin: () => ({ path: "/api/checkout", ...json({ userServiceId: id(A.paidOrder) }), expect: [403] }),
    },
    "GET /api/deliverables/[id]": {
      own: () => ({ path: `/api/deliverables/${id(A.deliverable)}`, expect: ["redirect"] }),
      anon: () => ({ path: `/api/deliverables/${id(A.deliverable)}`, expect: ["login"] }),
      other: () => ({ path: `/api/deliverables/${id(B.deliverable)}`, expect: [404] }),
      admin: () => ({ path: `/api/deliverables/${id(A.deliverable)}`, expect: [404] }),
    },
    "GET /api/documents/[id]": {
      own: () => ({ path: `/api/documents/${id(A.document)}`, expect: ["redirect"] }),
      anon: () => ({ path: `/api/documents/${id(A.document)}`, expect: ["login"] }),
      other: () => ({ path: `/api/documents/${id(B.document)}`, expect: [404] }),
      admin: () => ({ path: `/api/documents/${id(A.document)}`, expect: [404] }),
    },
    "POST /api/documents/confirm": {
      // An uploaded row: confirming again is a no-op that answers the row.
      own: () => ({
        path: "/api/documents/confirm",
        ...json({ documentId: id(A.document) }),
        expect: A.document?.status === "uploaded" ? [200] : [409],
      }),
      anon: () => ({ path: "/api/documents/confirm", ...json({ documentId: id(A.document) }), expect: [401] }),
      other: () => ({ path: "/api/documents/confirm", ...json({ documentId: id(B.document) }), expect: [403] }),
      admin: () => ({ path: "/api/documents/confirm", ...json({ documentId: id(A.document) }), expect: [403] }),
    },
    "POST /api/documents/upload-url": {
      // A slot of another service: the owner passes every check up to that one, and nothing is written.
      own: () => ({ path: "/api/documents/upload-url", ...json(uploadBody(A.paidOrder)), expect: [422] }),
      anon: () => ({ path: "/api/documents/upload-url", ...json(uploadBody(A.paidOrder)), expect: [401] }),
      other: () => ({ path: "/api/documents/upload-url", ...json(uploadBody(B.paidOrder)), expect: [403] }),
      admin: () => ({ path: "/api/documents/upload-url", ...json(uploadBody(A.paidOrder)), expect: [403] }),
    },
    "GET /api/orders/[id]/applicants/[index]": {
      own: () => ({ path: `/api/orders/${id(A.paidOrder)}/applicants/0`, expect: A.applicant ? [200] : [404] }),
      anon: () => ({ path: `/api/orders/${id(A.paidOrder)}/applicants/0`, expect: [401] }),
      other: () => ({ path: `/api/orders/${id(B.paidOrder)}/applicants/0`, expect: [403] }),
      admin: () => ({ path: `/api/orders/${id(A.paidOrder)}/applicants/0`, expect: A.applicant ? [200] : [404] }),
    },
    "PUT /api/orders/[id]/applicants/[index]": {
      // The details each row already holds, sent back: a leak would rewrite a demo row with its own values.
      own: () => ({
        path: `/api/orders/${id(A.paidOrder)}/applicants/0`,
        ...applicantBody(A.applicant),
        expect: A.applicant ? [200] : [400],
      }),
      anon: () => ({ path: `/api/orders/${id(A.paidOrder)}/applicants/0`, ...applicantBody(A.applicant), expect: [401] }),
      other: () => ({ path: `/api/orders/${id(B.paidOrder)}/applicants/0`, ...applicantBody(B.applicant), expect: [403] }),
      admin: () => ({ path: `/api/orders/${id(A.paidOrder)}/applicants/0`, ...RAW, expect: [403] }),
    },
    "GET /api/orders/[id]/poa/[docId]": {
      own: () => ({ path: `/api/orders/${id(A.paidOrder)}/poa/${id(A.deedDoc)}?applicant=0`, expect: [200] }),
      anon: () => ({ path: `/api/orders/${id(A.paidOrder)}/poa/${id(A.deedDoc)}?applicant=0`, expect: ["login"] }),
      other: () => ({ path: `/api/orders/${id(B.paidOrder)}/poa/${id(B.deedDoc)}?applicant=0`, expect: [403] }),
      admin: () => ({ path: `/api/orders/${id(A.paidOrder)}/poa/${id(A.deedDoc)}?applicant=0`, expect: [200] }),
    },
    "POST /api/orders/[id]/contract": {
      // An order whose agreement exists and was emailed: the answer is "ready" and nothing is written or sent.
      own: () => ({ path: `/api/orders/${id(A.contractOrder)}/contract`, ...json({}), expect: [200] }),
      anon: () => ({ path: `/api/orders/${id(A.contractOrder)}/contract`, ...json({}), expect: [401] }),
      other: () => ({ path: `/api/orders/${id(B.contractOrder)}/contract`, ...json({}), expect: [403] }),
      admin: () => ({ path: `/api/orders/${id(A.contractOrder)}/contract`, ...json({}), expect: [403] }),
    },
    "GET /api/orders/[id]/contract": {
      own: () => ({ path: `/api/orders/${id(A.contractOrder)}/contract`, expect: [200] }),
      anon: () => ({ path: `/api/orders/${id(A.contractOrder)}/contract`, expect: ["login"] }),
      other: () => ({ path: `/api/orders/${id(B.contractOrder)}/contract`, expect: [403] }),
      admin: () => ({ path: `/api/orders/${id(A.contractOrder)}/contract`, expect: [200] }),
    },
    "POST /api/orders": {
      // A slug no service has: past the session check, nothing is created.
      own: () => ({ path: "/api/orders", ...json({ serviceSlug: "authz-probe-none" }), expect: [404] }),
      anon: () => ({ path: "/api/orders", ...json({ serviceSlug: "authz-probe-none" }), expect: [401] }),
      other: null,
      admin: () => ({ path: "/api/orders", ...json({ serviceSlug: "authz-probe-none" }), expect: [404] }),
    },
    "POST /api/stripe/webhook": {
      public: true,
      own: () => ({ path: "/api/stripe/webhook", body: "{}", type: "application/json", expect: [400, 503] }),
      other: null,
      admin: () => ({ path: "/api/stripe/webhook", body: "{}", type: "application/json", expect: [400, 503] }),
    },

    // --- Admin routes: refused to anon (401) and to any client (403) -----------
    "GET /api/admin/deliverables/[id]": adminRoute({
      own: () => ({ path: `/api/admin/deliverables/${id(A.deliverable)}` }),
      other: () => ({ path: `/api/admin/deliverables/${id(B.deliverable)}` }),
      admin: () => ({ path: `/api/admin/deliverables/${id(A.deliverable)}`, expect: ["redirect"] }),
    }),
    "DELETE /api/admin/deliverables/[id]": adminRoute({
      own: () => ({ path: `/api/admin/deliverables/${id(A.deliverable)}` }),
      other: () => ({ path: `/api/admin/deliverables/${id(B.deliverable)}` }),
      // An id nothing has: the admin gets past the check and nothing is deleted.
      admin: () => ({ path: `/api/admin/deliverables/${fx.missing}`, expect: [404] }),
    }),
    "POST /api/admin/deliverables/confirm": adminRoute({
      own: () => ({ path: "/api/admin/deliverables/confirm", ...RAW }),
      other: () => ({ path: "/api/admin/deliverables/confirm", ...RAW }),
      admin: () => ({ path: "/api/admin/deliverables/confirm", ...RAW, expect: [400] }),
    }),
    "POST /api/admin/deliverables/upload-url": adminRoute({
      own: () => ({ path: "/api/admin/deliverables/upload-url", ...RAW }),
      other: () => ({ path: "/api/admin/deliverables/upload-url", ...RAW }),
      admin: () => ({ path: "/api/admin/deliverables/upload-url", ...RAW, expect: [400] }),
    }),
    "POST /api/admin/documents/[id]/review": adminRoute({
      own: () => ({ path: `/api/admin/documents/${id(A.document)}/review`, ...RAW }),
      other: () => ({ path: `/api/admin/documents/${id(B.document)}/review`, ...RAW }),
      admin: () => ({ path: `/api/admin/documents/${id(A.document)}/review`, ...RAW, expect: [400] }),
    }),
    "GET /api/admin/documents/[id]": adminRoute({
      own: () => ({ path: `/api/admin/documents/${id(A.document)}` }),
      other: () => ({ path: `/api/admin/documents/${id(B.document)}` }),
      admin: () => ({ path: `/api/admin/documents/${id(A.document)}`, expect: ["redirect"] }),
    }),
    "POST /api/admin/feedback": adminRoute({
      own: () => ({ path: "/api/admin/feedback", ...RAW }),
      other: null,
      admin: () => ({ path: "/api/admin/feedback", ...RAW, expect: [400] }),
    }),
    "PATCH /api/admin/feedback": adminRoute({
      own: () => ({ path: "/api/admin/feedback", ...RAW }),
      other: null,
      admin: () => ({ path: "/api/admin/feedback", ...RAW, expect: [400] }),
    }),
    "POST /api/admin/orders/[id]/contract": adminRoute({
      // No body to refuse, so an unpaid demo order: the route stops at "Payment first."
      own: () => ({ path: `/api/admin/orders/${id(A.unpaidOrder)}/contract` }),
      other: () => ({ path: `/api/admin/orders/${id(B.unpaidOrder)}/contract` }),
      admin: () => ({ path: `/api/admin/orders/${id(A.unpaidOrder)}/contract`, expect: [404, 409] }),
    }),
    "PATCH /api/admin/orders/[id]": adminRoute({
      own: () => ({ path: `/api/admin/orders/${id(A.paidOrder)}`, ...RAW }),
      other: () => ({ path: `/api/admin/orders/${id(B.paidOrder)}`, ...RAW }),
      admin: () => ({ path: `/api/admin/orders/${id(A.paidOrder)}`, ...RAW, expect: [400] }),
    }),
    "POST /api/admin/orders/[id]/stage": adminRoute({
      own: () => ({ path: `/api/admin/orders/${id(A.paidOrder)}/stage`, ...RAW }),
      other: () => ({ path: `/api/admin/orders/${id(B.paidOrder)}/stage`, ...RAW }),
      admin: () => ({ path: `/api/admin/orders/${id(A.paidOrder)}/stage`, ...RAW, expect: [400] }),
    }),
    "POST /api/admin/password": adminRoute({
      own: () => ({ path: "/api/admin/password", ...RAW }),
      other: null,
      admin: () => ({ path: "/api/admin/password", ...RAW, expect: [400] }),
    }),
    "GET /api/admin/services/[id]": adminRoute({
      own: () => ({ path: `/api/admin/services/${A.serviceId ?? fx.missing}` }),
      other: () => ({ path: `/api/admin/services/${B.serviceId ?? fx.missing}` }),
      admin: () => ({ path: `/api/admin/services/${A.serviceId ?? fx.missing}`, expect: [200] }),
    }),
    "PATCH /api/admin/services/[id]": adminRoute({
      own: () => ({ path: `/api/admin/services/${A.serviceId ?? fx.missing}`, ...RAW }),
      other: () => ({ path: `/api/admin/services/${B.serviceId ?? fx.missing}`, ...RAW }),
      admin: () => ({ path: `/api/admin/services/${A.serviceId ?? fx.missing}`, ...RAW, expect: [400] }),
    }),
    "GET /api/admin/services": adminRoute({
      own: () => ({ path: "/api/admin/services" }),
      other: null,
      admin: () => ({ path: "/api/admin/services", expect: [200] }),
    }),
    "POST /api/admin/services": adminRoute({
      own: () => ({ path: "/api/admin/services", ...RAW }),
      other: null,
      admin: () => ({ path: "/api/admin/services", ...RAW, expect: [400] }),
    }),
  };

  function uploadBody(order) {
    return {
      userServiceId: id(order),
      serviceDocId: fx.foreignDocId ?? fx.missing,
      applicantIndex: 0,
      fileName: "authz-probe.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    };
  }
}

/** For a route this file has no probe for: fill the dynamic segments, send no JSON, expect refusals. */
function genericProbe(route, fx) {
  const fill = (actor) =>
    route.path.replace(/\[(\.\.\.)?([^\]]+)\]/g, (_, rest, name) => {
      if (rest) return "authz-probe";
      if (name === "index") return "0";
      if (/docid$/i.test(name)) return actor.deedDoc?.id ?? fx.missing;
      return actor.paidOrder?.id ?? fx.missing;
    });
  const hasBody = route.method !== "GET" && route.method !== "HEAD";
  const probe = (actor, expect) => () => ({ path: fill(actor), ...(hasBody ? RAW : NONE), expect });
  const isAdmin = route.path.startsWith("/api/admin/");
  const hasResource = /\[/.test(route.path);
  return {
    generic: true,
    anon: probe(fx.own, ["denied"]),
    own: probe(fx.own, isAdmin ? ["denied"] : null),
    other: hasResource ? probe(fx.other, ["denied"]) : null,
    // An unknown route that writes is not called as the admin: nothing says what it would change.
    admin: hasBody ? "skip: unknown write route" : probe(fx.own, null),
  };
}

// ---------------------------------------------------------------------------
// Calling and judging
// ---------------------------------------------------------------------------

async function call(method, probe, cookie) {
  const headers = { Accept: "application/json" };
  if (cookie) headers.Cookie = cookie;
  if (probe.body !== undefined) {
    headers["Content-Type"] = probe.type ?? "application/json";
    headers.Origin = BASE;
  }
  try {
    const res = await fetch(`${BASE}${probe.path}`, {
      method,
      headers,
      body: probe.body,
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const location = res.headers.get("location") ?? "";
    let message = "";
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      const body = await res.json().catch(() => null);
      if (body && typeof body.error === "string") message = body.error;
    } else {
      await res.arrayBuffer().catch(() => undefined);
    }
    let kind;
    if (res.status >= 300 && res.status < 400) {
      const target = location ? new URL(location, BASE).pathname : "";
      kind = /^\/(en|admin)\/login\/?$/.test(target) ? "login" : "redirect";
    } else if (res.status >= 200 && res.status < 300) kind = "ok";
    else if ([401, 403, 404].includes(res.status)) kind = "denied";
    else if (res.status === 405) kind = "method";
    else if (res.status >= 500) kind = "error";
    else kind = "validation";
    return { status: res.status, kind, message };
  } catch (error) {
    return { status: 0, kind: "error", message: error.name === "TimeoutError" ? "timeout" : error.message };
  }
}

function matches(result, expect) {
  return expect.some((token) => {
    if (typeof token === "number") return result.status === token;
    if (token === "login") return result.kind === "login";
    if (token === "redirect") return result.kind === "redirect";
    if (token === "denied") return result.kind === "denied" || result.kind === "login";
    return false;
  });
}

/**
 * The verdict for one cell. `guarded` is true where the caller must be
 * refused: anon on a route that is not public, Ana on Ben's rows, and any
 * client (or an admin signed in with a code) on /api/admin/*.
 */
function judge(result, expect, guarded) {
  const reached = result.kind === "ok" || result.kind === "redirect";
  if (guarded && reached) return "LEAK";
  if (expect && matches(result, expect)) return "";
  if (result.kind === "error") return "warn";
  if (guarded && result.kind === "validation") return "warn";
  if (expect && !matches(result, expect)) return "?";
  return "";
}

// ---------------------------------------------------------------------------
// Row level security, straight through PostgREST
// ---------------------------------------------------------------------------

const PROBE_ROWS = 1000;

/**
 * The tables the admin policies guard, and how to tell whether a row is the
 * admin account's own: by user, or by order. admin_feedback has no own-row
 * policy at all, so a session that is not an admin sees none of it.
 */
const RLS_TABLES = [
  { table: "users", columns: "id", own: (row, mine) => row.id === mine.userId },
  { table: "user_services", columns: "id, user_id", own: (row, mine) => row.user_id === mine.userId },
  { table: "admin_order_summary", columns: "id, user_id", own: (row, mine) => row.user_id === mine.userId },
  { table: "user_answers", columns: "id, user_id", own: (row, mine) => row.user_id === mine.userId },
  { table: "user_service_events", columns: "id, user_service_id", own: (row, mine) => mine.orderIds.has(row.user_service_id) },
  { table: "user_documents", columns: "id, user_service_id", own: (row, mine) => mine.orderIds.has(row.user_service_id) },
  { table: "user_service_deliverables", columns: "id, user_service_id", own: (row, mine) => mine.orderIds.has(row.user_service_id) },
  { table: "user_service_applicants", columns: "id, user_service_id", own: (row, mine) => mine.orderIds.has(row.user_service_id) },
  { table: "user_service_contracts", columns: "id, user_service_id", own: (row, mine) => mine.orderIds.has(row.user_service_id) },
  { table: "admin_feedback", columns: "id", own: () => false },
];

/**
 * Reads each table with the secret key (the truth), with the admin's code
 * session and with the admin's password session, both through PostgREST
 * with the publishable key. Counts only; no row is printed. Answers the
 * lines to print and the findings, in the route table's finding format.
 */
async function rlsProbe(url, publishable, secretClient, sessions, adminId) {
  const { data: ownOrders, error: ownError } = await secretClient.from("user_services").select("id").eq("user_id", adminId);
  if (ownError) throw new Error(`user_services: ${ownError.message}`);
  const mine = { userId: adminId, orderIds: new Set((ownOrders ?? []).map((o) => o.id)) };
  const asSession = (session) =>
    createClient(url, publishable, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    });
  const codeClient = asSession(sessions.adminCode);
  const passwordClient = asSession(sessions.admin);

  const rows = [];
  const findings = [];
  for (const spec of RLS_TABLES) {
    const truth = await secretClient.from(spec.table).select(spec.columns).limit(PROBE_ROWS);
    if (truth.error) {
      const missing = truth.error.code === "PGRST205" || /could not find the table/i.test(truth.error.message);
      rows.push([spec.table, "-", "-", "-", `not checked: ${missing ? "no such table (migration not applied?)" : truth.error.message.slice(0, 60)}`]);
      continue;
    }
    const foreign = (data) => (data ?? []).filter((row) => !spec.own(row, mine)).length;
    const total = foreign(truth.data);
    const code = await codeClient.from(spec.table).select(spec.columns).limit(PROBE_ROWS);
    const password = await passwordClient.from(spec.table).select(spec.columns).limit(PROBE_ROWS);
    const codeSeen = code.error ? null : foreign(code.data);
    const passwordSeen = password.error ? null : foreign(password.data);

    let verdict = "";
    if (codeSeen) {
      verdict = "LEAK";
      findings.push(
        `LEAK PostgREST ${spec.table} as adminCode: ${codeSeen} row(s) of other accounts ` +
          "(expected none; is 0011_admin_password_session.sql applied?)",
      );
    } else if (total > 0 && !passwordSeen) {
      verdict = "warn";
      findings.push(
        `warn PostgREST ${spec.table} as admin: ${passwordSeen === null ? `error: ${password.error.message.slice(0, 80)}` : "no row of other accounts"}` +
          ` (expected ${total}); the admin pages read through RLS`,
      );
    }
    rows.push([
      spec.table,
      String(total),
      codeSeen === null ? "refused" : String(codeSeen),
      passwordSeen === null ? "refused" : String(passwordSeen),
      verdict,
    ]);
  }
  return { rows, findings };
}

async function main() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const publishable = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const secret = env("SUPABASE_SECRET_KEY");
  if (!url || !publishable || !secret) {
    console.error("Missing in .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY.");
    process.exit(2);
  }
  const admin = authClient(url, secret);

  // --- Server up? -------------------------------------------------------------
  try {
    await fetch(`${BASE}/api/orders`, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    console.error(`Cannot reach ${BASE} (${error.message}). Is the dev server running?`);
    process.exit(2);
  }

  // --- Fixtures ---------------------------------------------------------------
  const own = await fixturesFor(admin, OWN_EMAIL);
  const other = await fixturesFor(admin, OTHER_EMAIL);
  if (!own || !other || !own.paidOrder || !other.paidOrder) {
    console.error(`The demo accounts ${OWN_EMAIL} and ${OTHER_EMAIL} with paid orders are needed. Run npm run demo:seed first.`);
    process.exit(2);
  }
  if (own.role !== "client" || other.role !== "client") {
    console.error("A demo account is not a client. Refusing to run.");
    process.exit(2);
  }
  const { data: foreignDocs, error: foreignError } = await admin
    .from("service_docs")
    .select("id, service_id")
    .neq("service_id", own.paidOrder.service_id)
    .limit(1);
  if (foreignError) throw new Error(`service_docs: ${foreignError.message}`);
  const fx = { own, other, foreignDocId: foreignDocs?.[0]?.id ?? null, missing: randomUUID() };

  // --- Sessions ---------------------------------------------------------------
  const publicClient = authClient(url, publishable);
  const opened = [];
  const ownSession = await codeSession(admin, publicClient, OWN_EMAIL);
  opened.push(ownSession);
  const cookies = { anon: null, own: sessionCookie(url, ownSession), other: sessionCookie(url, ownSession) };

  const adminEmail = env("ADMIN_SUPPORT_EMAIL");
  const adminPassword = env("ADMIN_SUPPORT_PASSWORD");
  let adminNote = "";
  /** The two admin sessions, kept for the PostgREST probe after the routes. */
  const adminSessions = {};
  if (adminEmail && adminPassword) {
    const signIn = await authClient(url, publishable).auth.signInWithPassword({ email: adminEmail, password: adminPassword });
    if (signIn.error || !signIn.data.session) {
      adminNote = `admin columns skipped: password sign in failed (${signIn.error?.message ?? "no session"})`;
    } else {
      const { data: role } = await admin.from("users").select("role").eq("id", signIn.data.user.id).maybeSingle();
      if (role?.role !== "admin") {
        adminNote = "admin columns skipped: ADMIN_SUPPORT_EMAIL is not an admin account";
        await admin.auth.admin.signOut(signIn.data.session.access_token, "local").catch(() => undefined);
      } else {
        opened.push(signIn.data.session);
        cookies.admin = sessionCookie(url, signIn.data.session);
        const adminCode = await codeSession(admin, publicClient, adminEmail);
        opened.push(adminCode);
        cookies.adminCode = sessionCookie(url, adminCode);
        adminSessions.admin = signIn.data.session;
        adminSessions.adminCode = adminCode;
        adminSessions.userId = signIn.data.user.id;
      }
    }
  } else {
    adminNote = "admin columns skipped: ADMIN_SUPPORT_EMAIL and ADMIN_SUPPORT_PASSWORD are not in .env.local";
  }
  if (adminNote) console.warn(`\n  ! ${adminNote}`);

  // --- Plan -------------------------------------------------------------------
  const routes = discoverRoutes();
  const known = knownProbes(fx);
  const roles = ["anon", "own", "other", "admin", "adminCode"];
  const plan = routes.map((route) => {
    const key = `${route.method} ${route.path}`;
    const spec = known[key] ?? genericProbe(route, fx);
    return { route, key, spec };
  });
  // Sign out ends Ana's sessions, so it goes last.
  plan.sort((a, b) => Number(Boolean(a.spec.last)) - Number(Boolean(b.spec.last)));

  console.log(`\nAuthorization matrix against ${BASE}: ${routes.length} route methods`);
  console.log(`  own = ${OWN_EMAIL} on her orders, other = the same session on ${OTHER_EMAIL}'s\n`);

  const results = [];
  for (const { route, key, spec } of plan) {
    const cells = {};
    for (const role of roles) {
      // anon defaults to the owner's probe; admin-code, a client session on the admin's account, to the admin's.
      const probeFn = {
        anon: spec.anon ?? spec.own,
        own: spec.own,
        other: spec.other,
        admin: spec.admin,
        adminCode: spec.adminCode ?? spec.admin,
      }[role];
      if ((role === "admin" || role === "adminCode") && !cookies.admin) {
        cells[role] = { text: "skip" };
        continue;
      }
      if (probeFn === null || probeFn === undefined) {
        cells[role] = { text: "-" };
        continue;
      }
      if (typeof probeFn === "string") {
        cells[role] = { text: "skip", note: probeFn };
        continue;
      }
      const probe = probeFn();
      const isAdminRoute = route.path.startsWith("/api/admin/");
      // The admin's probes on client routes name Ana's rows: with a code session the admin is just another client.
      const namesAnasRows = route.path.includes("[") || BODY_NAMES_AN_ORDER.has(key);
      let expect = probe.expect ?? null;
      if (isAdminRoute && role === "anon") expect = [401];
      if (isAdminRoute && (role === "own" || role === "other")) expect = [403];
      if (isAdminRoute && role === "adminCode") expect = [401, 403];
      if (role === "adminCode" && !isAdminRoute) expect = namesAnasRows ? ["denied"] : (probe.expect ?? null);
      const guarded =
        (role === "anon" && !spec.public) ||
        role === "other" ||
        (isAdminRoute && (role === "own" || role === "adminCode")) ||
        (role === "adminCode" && namesAnasRows);
      const result = await call(route.method, probe, cookies[role]);
      const verdict = judge(result, expect, guarded);
      cells[role] = { text: `${result.status || "ERR"}${verdict ? ` ${verdict}` : ""}`, verdict, result, expect };
      process.stdout.write(verdict === "LEAK" ? "L" : verdict ? "!" : ".");
    }
    results.push({ route, key, spec, cells });
  }
  process.stdout.write("\n\n");

  // --- Row level security through PostgREST, while the admin sessions are open ---
  const rls = adminSessions.adminCode
    ? await rlsProbe(url, publishable, admin, adminSessions, adminSessions.userId)
    : null;

  // --- Close the sessions opened here (Ana's is already gone if sign out ran) ---
  for (const session of opened) {
    await admin.auth.admin.signOut(session.access_token, "local").catch(() => undefined);
  }

  // --- Table ------------------------------------------------------------------
  const headers = ["route", "method", "anon", "own", "other", "admin", "admin-code"];
  const rows = results
    .sort((a, b) => a.route.path.localeCompare(b.route.path) || METHODS.indexOf(a.route.method) - METHODS.indexOf(b.route.method))
    .map(({ route, spec, cells }) => [
      `${route.path}${spec.generic ? " *" : ""}`,
      route.method,
      ...roles.map((role) => cells[role].text),
    ]);
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const line = (cols) => cols.map((c, i) => String(c).padEnd(widths[i])).join("  ");
  console.log(line(headers));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of rows) console.log(line(row));

  if (rls) {
    const rlsHeaders = ["PostgREST table", "others' rows", "admin-code sees", "admin sees", ""];
    const rlsWidths = rlsHeaders.map((h, i) => Math.max(h.length, ...rls.rows.map((r) => String(r[i]).length)));
    const rlsLine = (cols) => cols.map((c, i) => String(c).padEnd(rlsWidths[i])).join("  ").trimEnd();
    console.log(`\n${rlsLine(rlsHeaders)}`);
    console.log(rlsWidths.map((w) => "-".repeat(w)).join("  "));
    for (const row of rls.rows) console.log(rlsLine(row));
  }

  // --- Findings ---------------------------------------------------------------
  const findings = [...(rls?.findings ?? [])];
  const skips = new Set();
  for (const { route, cells } of results) {
    for (const role of roles) {
      const cell = cells[role];
      if (cell.note) skips.add(`${route.method} ${route.path} as ${role}: ${cell.note}`);
      if (!cell.verdict) continue;
      const expected = cell.expect ? cell.expect.join("|") : "anything";
      findings.push(
        `${cell.verdict.padEnd(4)} ${route.method} ${route.path} as ${role}: ${cell.result.status || "no answer"}` +
          ` (expected ${expected})${cell.result.message ? `: ${cell.result.message.slice(0, 100)}` : ""}`,
      );
    }
  }
  const generic = results.filter((r) => r.spec.generic).map((r) => `${r.route.method} ${r.route.path}`);

  console.log("\nlegend: LEAK must be refused and was not; warn past the check to a validation error, or a 5xx;");
  console.log("        ? a refusal other than the expected one; skip not called on purpose; - no such case");
  if (generic.length) console.log(`\n* generic probe (no probe written for it yet): ${generic.join(", ")}`);
  if (skips.size) console.log(`\nskipped:\n  ${[...skips].join("\n  ")}`);
  if (adminNote) console.log(`\n${adminNote}`);
  if (findings.length) console.log(`\nfindings:\n  ${findings.join("\n  ")}`);

  const leaks = findings.filter((f) => f.startsWith("LEAK")).length;
  console.log(leaks ? `\n${leaks} LEAK(s). Exit 1.\n` : "\nNo leak: every guarded call was refused.\n");
  process.exit(leaks ? 1 : 0);
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(2);
});
