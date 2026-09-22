#!/usr/bin/env node
/**
 * Two years of business, as training and QA data.
 *
 *   npm run demo:history                    dry run: prints, writes nothing
 *   npm run demo:history -- --apply         writes
 *   npm run demo:history -- --reset --apply wipes every client account first
 *   npm run demo:history -- --reset         shows what --reset would take
 *
 * Why it exists. scripts/seed-demo.mjs makes seven orders, enough for a
 * screenshot. This makes about fifty clients and about eighty orders spread
 * over twenty four months, so every screen of /admin has something to show:
 * the KPI tiles, the four charts, every range filter (7 days, 30 days, 3, 6
 * and 12 months, custom dates), the orders table, the board, the users list
 * and the review queue. On top of that it writes eight named fixtures the
 * founder's test checklist walks through by name.
 *
 * Everything is on the reserved domain demo.alttavia.invalid (RFC 2606), the
 * same domain seed-demo uses, so no email ever leaves: sendEmail skips every
 * .invalid recipient and answers ok. `npm run db:purge -- --demo --apply`
 * removes what this writes, accounts and files included.
 *
 * Deterministic. Row ids come from a fixed name ("alttavia-history:<name>")
 * and everything random comes from seeded generators, so a second run updates
 * the same rows instead of adding new ones. Dates are relative to today and
 * anchored at 10:00 UTC, so two runs on the same day write the same
 * timestamps. Account ids are Supabase's, looked up by email.
 *
 * Runs under tsx (see package.json) because the service agreements are the
 * real ones, from src/lib/contracts/generate.ts with the values
 * src/content/contracts/variables.ts builds. Every other file is a one page
 * placeholder stamped "SAMPLE FOR TRAINING. NOT A REAL DOCUMENT.".
 *
 * Reads .env.local with the readEnvFile pattern of scripts/stripe-setup.mjs:
 * NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY for the database and the
 * Auth admin API, S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID,
 * S3_SECRET_ACCESS_KEY (S3_REGION optional) for the files. Without the S3
 * variables the rows are still written and no file is uploaded. Nothing
 * secret is printed.
 *
 * Safety:
 *   - dry run by default; --apply writes;
 *   - --reset only deletes with --apply, and refuses outright when any order
 *     carries a live Stripe session (cs_live_) unless --include-live is
 *     passed, so real customers are never wiped by accident;
 *   - an account whose role is admin is never deleted;
 *   - every object key is checked against orders/<id>/, deliverables/<id>/
 *     and contracts/<id>/ for an id this run owns before anything is written.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const DEMO_DOMAIN = "demo.alttavia.invalid";
const SAMPLE_STAMP = "SAMPLE FOR TRAINING. NOT A REAL DOCUMENT.";
const SEED_NOTE = "Seeded for training (scripts/seed-history.mjs)";

/** The window the history covers. The last month is the current one. */
const START_MONTH = { y: 2024, m: 10 };

/** How much of each kind the generated part holds. Fixtures are extra. */
const TARGET = { clients: 48, completed: 45, inProgress: 18, unpaid: 12 };

/** Weights of the four services, as the brief asks: 35 / 35 / 20 / 10. */
const SERVICE_WEIGHTS = [
  ["nif-only", 35],
  ["bundle", 35],
  ["bank-only", 20],
  ["couple", 10],
];

const PAGE = 1000;
const CHUNK = 50;
const UPSERT_CHUNK = 200;
const UPLOAD_CONCURRENCY = 5;

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const reset = args.has("--reset");
const includeLive = args.has("--include-live");

if (args.has("--help") || args.has("-h")) {
  console.log(
    [
      "",
      "  npm run demo:history                      dry run, writes nothing",
      "  npm run demo:history -- --apply           write the dataset",
      "  npm run demo:history -- --reset           show what a reset would take",
      "  npm run demo:history -- --reset --apply   delete every client account, then write",
      "  npm run demo:history -- --reset --apply --include-live",
      "                                            allow the reset although a cs_live_ order exists",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/** Minimal .env reader, the same one scripts/stripe-setup.mjs uses. */
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

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function fail(message) {
  throw new Error(message);
}

async function check(label, promise) {
  const { data, error } = await promise;
  if (error) fail(`${label}: ${error.message}`);
  return data;
}

function chunks(list, size = CHUNK) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Runs `worker` over `items`, at most `size` at a time, in order. */
async function pool(items, size, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(size, items.length)) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

/** A uuid that is always the same for the same name, shaped as version 5. */
function historyId(name) {
  const bytes = createHash("sha256").update(`alttavia-history:${name}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A Stripe test session id that is always the same for the same order. */
function testSessionId(orderId) {
  return `cs_test_${createHash("sha256").update(`session:${orderId}`).digest("hex").slice(0, 24)}`;
}

function testPaymentIntentId(orderId) {
  return `pi_test_${createHash("sha256").update(`intent:${orderId}`).digest("hex").slice(0, 24)}`;
}

/** Deterministic pseudo random numbers in [0, 1). One stream per concern. */
function stream(seedText) {
  let a = createHash("sha256").update(seedText).digest().readUInt32BE(0);
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rnd, list) {
  return list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];
}

function between(rnd, min, max) {
  return min + rnd() * (max - min);
}

function intBetween(rnd, min, max) {
  return Math.min(max, min + Math.floor(rnd() * (max - min + 1)));
}

/** Weighted pick over [[value, weight], ...]. */
function weighted(rnd, pairs) {
  const total = pairs.reduce((sum, [, weight]) => sum + weight, 0);
  let r = rnd() * total;
  for (const [value, weight] of pairs) {
    r -= weight;
    if (r <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
}

/** Text a standard PDF font can draw: WinAnsi only, anything else dropped. */
function safeText(value) {
  return String(value ?? "").replace(/[^ -ÿ]/g, "?");
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const NOW = new Date();
/** Today at 10:00 UTC. Every relative date hangs off this, so a rerun on the
 *  same day writes the same timestamps whatever the clock says. */
const ANCHOR = Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate(), 10, 0, 0);
/** Nothing seeded is allowed to sit in the future. */
const LATEST = NOW.getTime() - HOUR;

function daysAgo(days) {
  return new Date(ANCHOR - days * DAY);
}

function iso(date) {
  return date.toISOString();
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY);
}

function notAfterNow(date) {
  return date.getTime() > LATEST ? new Date(LATEST) : date;
}

const MONTH_COUNT =
  (NOW.getUTCFullYear() - START_MONTH.y) * 12 + (NOW.getUTCMonth() + 1 - START_MONTH.m) + 1;

function monthStart(index) {
  return new Date(Date.UTC(START_MONTH.y, START_MONTH.m - 1 + index, 1));
}

function monthKeyOf(index) {
  const date = monthStart(index);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** A working hour on a day inside month `index`. Never in the future. */
function dateInMonth(index, rnd) {
  const start = monthStart(index);
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const isCurrent = index === MONTH_COUNT - 1;
  const maxDay = isCurrent ? Math.max(1, NOW.getUTCDate() - 1) : daysInMonth;
  const day = intBetween(rnd, 1, maxDay);
  const hour = intBetween(rnd, 8, 18);
  const minute = intBetween(rnd, 0, 59);
  return notAfterNow(new Date(Date.UTC(y, m, day, hour, minute)));
}

/** Month index of a date, clamped into the window. */
function monthIndexOf(date) {
  const raw = (date.getUTCFullYear() - START_MONTH.y) * 12 + (date.getUTCMonth() + 1 - START_MONTH.m);
  return Math.max(0, Math.min(MONTH_COUNT - 1, raw));
}

/** A month index, newer months more likely. `bias` 0 is flat. */
function recentMonth(rnd, bias = 0.35, maxIndex = MONTH_COUNT - 1) {
  const pairs = [];
  for (let i = 0; i <= maxIndex; i += 1) pairs.push([i, 1 + bias * i]);
  return weighted(rnd, pairs);
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const COUNTRIES = {
  US: {
    name: "United States",
    issuer: "United States Department of State",
    eea: false,
    phone: "+1 202 555 0",
    places: [
      ["Austin", "TX", "78703"],
      ["Denver", "CO", "80203"],
      ["Portland", "OR", "97205"],
      ["Charleston", "SC", "29403"],
      ["Boston", "MA", "02116"],
      ["Phoenix", "AZ", "85004"],
    ],
  },
  GB: {
    name: "United Kingdom",
    issuer: "HM Passport Office",
    eea: false,
    phone: "+44 20 7946 0",
    places: [
      ["Bristol", "", "BS1 5TR"],
      ["Leeds", "", "LS1 4AP"],
      ["Brighton", "", "BN1 1AE"],
      ["Manchester", "", "M1 1AA"],
    ],
  },
  CA: {
    name: "Canada",
    issuer: "Immigration, Refugees and Citizenship Canada",
    eea: false,
    phone: "+1 416 555 0",
    places: [
      ["Toronto", "ON", "M5V 2T6"],
      ["Vancouver", "BC", "V6B 1A1"],
      ["Montreal", "QC", "H3B 2Y5"],
    ],
  },
  BR: {
    name: "Brazil",
    issuer: "Policia Federal",
    eea: false,
    phone: "+55 11 95555 0",
    places: [
      ["Sao Paulo", "SP", "01310-100"],
      ["Rio de Janeiro", "RJ", "22070-900"],
      ["Belo Horizonte", "MG", "30130-010"],
    ],
  },
  DE: {
    name: "Germany",
    issuer: "Bundesdruckerei GmbH",
    eea: true,
    phone: "+49 30 2000 0",
    places: [
      ["Berlin", "", "10115"],
      ["Hamburg", "", "20095"],
      ["Munich", "", "80331"],
    ],
  },
  FR: {
    name: "France",
    issuer: "Prefecture de Police de Paris",
    eea: true,
    phone: "+33 1 99 00 0",
    places: [
      ["Paris", "", "75011"],
      ["Lyon", "", "69002"],
    ],
  },
  IN: {
    name: "India",
    issuer: "Ministry of External Affairs",
    eea: false,
    phone: "+91 22 5550 0",
    places: [
      ["Mumbai", "", "400001"],
      ["Bengaluru", "", "560001"],
    ],
  },
};

/** Partners on a Couple package order: the second applicant of the household. */
const PARTNER_NAMES = {
  f: ["Claire", "Naomi", "Elise", "Martina", "Tessa", "Joanna", "Rosa", "Lydia"],
  m: ["Adrian", "Miles", "Victor", "Simon", "Theo", "Rowan", "Elias", "Peter"],
};

const STREETS = [
  "Maple Street",
  "Oak Avenue",
  "Cedar Lane",
  "Harbour Road",
  "Willow Court",
  "Chestnut Way",
  "Riverside Drive",
  "Bramble Close",
  "Aldgate Terrace",
  "Sycamore Grove",
];

/** The generated buyers: mostly US and UK, a few of the rest. */
const NAMES = [
  ["James", "Whitaker", "m", "US"],
  ["Sarah", "Donnelly", "f", "US"],
  ["Michael", "Brennan", "m", "US"],
  ["Jennifer", "Caldwell", "f", "US"],
  ["Robert", "Ashford", "m", "US"],
  ["Laura", "Pemberton", "f", "US"],
  ["David", "Kowalski", "m", "US"],
  ["Rachel", "Lindqvist", "f", "US"],
  ["Christopher", "Vaughn", "m", "US"],
  ["Amanda", "Ruiz", "f", "US"],
  ["Steven", "Ackerman", "m", "US"],
  ["Nicole", "Barrett", "f", "US"],
  ["Brian", "Holloway", "m", "US"],
  ["Katherine", "Voss", "f", "US"],
  ["Gregory", "Mullins", "m", "US"],
  ["Danielle", "Frost", "f", "US"],
  ["Patrick", "Sullivan", "m", "US"],
  ["Melissa", "Trent", "f", "US"],
  ["Andrew", "Sinclair", "m", "US"],
  ["Christine", "Fairbanks", "f", "US"],
  ["Jonathan", "Hale", "m", "US"],
  ["Rebecca", "Nolan", "f", "US"],
  ["Edward", "Ashcroft", "m", "GB"],
  ["Charlotte", "Bexley", "f", "GB"],
  ["Harry", "Kingsley", "m", "GB"],
  ["Imogen", "Radcliffe", "f", "GB"],
  ["Nathan", "Prescott", "m", "GB"],
  ["Felicity", "Marchant", "f", "GB"],
  ["Callum", "Ferris", "m", "GB"],
  ["Sophie", "Alderton", "f", "GB"],
  ["Dominic", "Hartley", "m", "GB"],
  ["Eleanor", "Wycliffe", "f", "GB"],
  ["Marcus", "Tindall", "m", "GB"],
  ["Beatrice", "Lomax", "f", "GB"],
  ["Ethan", "Beaulieu", "m", "CA"],
  ["Chloe", "Tremblay", "f", "CA"],
  ["Connor", "McKinnon", "m", "CA"],
  ["Alexis", "Gagnon", "f", "CA"],
  ["Rafael", "Andrade", "m", "BR"],
  ["Camila", "Moreira", "f", "BR"],
  ["Bruno", "Teixeira", "m", "BR"],
  ["Lukas", "Brandt", "m", "DE"],
  ["Annika", "Hoffmann", "f", "DE"],
  ["Sebastian", "Vogel", "m", "DE"],
  ["Julien", "Marchand", "m", "FR"],
  ["Celine", "Dubois", "f", "FR"],
  ["Arjun", "Mehta", "m", "IN"],
  ["Ananya", "Iyer", "f", "IN"],
];

function emailFor(first, last) {
  const slug = (value) =>
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  return `${slug(first)}.${slug(last)}@${DEMO_DOMAIN}`;
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * The nine deed fields for one person, plausible and always valid by the
 * rules in src/lib/orders/applicant-rules.ts: an adult, a passport issued in
 * the past, expiring ten years later and therefore not expired.
 */
function personDetails(first, last, gender, country, rnd) {
  const info = COUNTRIES[country];
  const [city, region, postcode] = pick(rnd, info.places);
  const birthYear = intBetween(rnd, 1962, 1995);
  const birthMonth = intBetween(rnd, 1, 12);
  const birthDay = intBetween(rnd, 1, 28);
  const issueYear = intBetween(rnd, 2019, 2024);
  const issueMonth = intBetween(rnd, 1, 12);
  const issueDay = intBetween(rnd, 1, 28);
  const number = String(intBetween(rnd, 1000000, 9999999));
  const street = pick(rnd, STREETS);
  const houseNumber = intBetween(rnd, 3, 480);
  const addressCity = [city, region].filter(Boolean).join(", ");
  return {
    full_name: `${first} ${last}`,
    gender,
    birth_place: `${city}, ${info.name}`,
    birth_date: `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`,
    passport_number: `${country}${number}`,
    passport_issuer: info.issuer,
    passport_issued_on: `${issueYear}-${String(issueMonth).padStart(2, "0")}-${String(issueDay).padStart(2, "0")}`,
    passport_expires_on: `${issueYear + 10}-${String(issueMonth).padStart(2, "0")}-${String(issueDay).padStart(2, "0")}`,
    tax_address: `${houseNumber} ${street}, ${addressCity} ${postcode}, ${info.name}`,
  };
}

const REJECTION_REASONS = [
  "The scan is too dark to read. Upload a clear copy of the full page.",
  "This bill is older than three months. Send a recent one.",
  "One corner of the page is cut off. Photograph the whole page.",
  "The signature does not match the passport. Sign again and send a new scan.",
  "The file opens blank on our side. Try a PDF export instead of a screenshot.",
];

const REPORTS = [
  "Your NIF was issued and your Financas access is active. Both documents are below. Keep the Portal password somewhere safe. Tax representation runs for 12 months from the issue date.",
  "Your account is open and the IBAN is in the document below. The card and the online banking codes are posted to the address on file. Write to us once they arrive and we will check the first login with you.",
  "Everything is done: the NIF, the Financas access and the IBAN are all below. The tax representation address stays ours until you register as resident, so keep forwarding us anything that arrives.",
  "Your NIF is issued. The bank asked for one extra statement, which you sent, and the account was opened the same week. The IBAN and the confirmation letter are below.",
];

// ---------------------------------------------------------------------------
// The named fixtures the founder's checklist walks through
// ---------------------------------------------------------------------------

/**
 * Each one names a client, a service, a stage and exactly what the order
 * holds. `docs` maps a service_docs key to one entry per applicant:
 *   null                       leave the slot empty
 *   "approved" | "uploaded"    one row with that status
 *   { status, reason }         a rejected row
 *   ["rejected:<reason>", "uploaded"]  two rows, oldest first
 * "all-approved" fills every slot of the service, every applicant.
 */
const FIXTURES = [
  {
    key: "margaret-hill",
    first: "Margaret",
    last: "Hill",
    gender: "f",
    country: "US",
    accountDaysAgo: 3.4,
    service: "bundle",
    stage: "documents",
    createdDaysAgo: 3.2,
    paidDaysAgo: 3,
    session: "test",
    people: ["self"],
    answers: true,
    docs: "all-uploaded",
    contract: true,
    note: "documents stage, 7 files waiting for review; approve six, reject one, re-approve, then walk the stages",
  },
  {
    key: "thomas-reed",
    first: "Thomas",
    last: "Reed",
    gender: "m",
    country: "GB",
    accountDaysAgo: 5.4,
    service: "bank-only",
    stage: "documents",
    createdDaysAgo: 5.2,
    paidDaysAgo: 5,
    session: "test",
    people: ["self"],
    answers: true,
    docs: {
      passport: [["rejected:The photograph cuts off the bottom corner. Send the full page.", "uploaded"]],
      nif_document: ["uploaded"],
      origin_tax_number: ["uploaded"],
      bank_statements: ["uploaded"],
      employment_proof: ["uploaded"],
      proof_of_address: [null],
      poa_bank: [null],
    },
    contract: true,
    note: "5 slots to review, 2 empty (proof of address, bank deed); the passport slot shows 1 other upload",
  },
  {
    key: "priya-nair",
    first: "Priya",
    last: "Nair",
    gender: "f",
    country: "IN",
    accountDaysAgo: 12.5,
    service: "nif-only",
    stage: "nif_ready",
    createdDaysAgo: 12.3,
    paidDaysAgo: 12,
    session: "test",
    people: ["self"],
    answers: true,
    docs: "all-approved",
    contract: true,
    note: "every document approved, nothing returned yet: completing must warn 'Not sent yet: ...'",
  },
  {
    key: "daniel-okafor",
    first: "Daniel",
    last: "Okafor",
    gender: "m",
    country: "GB",
    partner: { first: "Sofia", last: "Okafor", gender: "f", country: "GB" },
    accountDaysAgo: 8.4,
    service: "couple",
    stage: "documents",
    createdDaysAgo: 8.2,
    paidDaysAgo: 8,
    session: "test",
    people: ["self", "partner"],
    answers: true,
    docs: {
      passport: ["approved", "approved"],
      proof_of_address: ["approved", "approved"],
      origin_tax_number: ["approved", "approved"],
      bank_statements: ["approved", "approved"],
      employment_proof: ["approved", "approved"],
      poa_nif: ["uploaded", "uploaded"],
      poa_bank: ["uploaded", "uploaded"],
    },
    contract: false,
    note: "two applicants, 14 slots: 10 approved, 4 to review; the Couple package has no agreement model",
  },
  {
    key: "hannah-brooks",
    first: "Hannah",
    last: "Brooks",
    gender: "f",
    country: "US",
    accountDaysAgo: 41,
    service: "bundle",
    stage: "terminal",
    createdDaysAgo: 40.3,
    paidDaysAgo: 40,
    endDaysAgo: 10,
    session: "test",
    people: ["self"],
    answers: true,
    docs: "all-approved",
    deliverables: "all",
    reportIndex: 2,
    contract: true,
    note: "completed 10 days ago with every deliverable and a report: Back then Forward sends no second email",
  },
  {
    key: "lucas-ferreira",
    first: "Lucas",
    last: "Ferreira",
    gender: "m",
    country: "BR",
    accountDaysAgo: 1.3,
    service: "nif-only",
    stage: "awaiting_payment",
    createdDaysAgo: 1,
    answers: true,
    note: "unpaid, no session id: the board must refuse to drag it",
  },
  {
    key: "oliver-grant",
    first: "Oliver",
    last: "Grant",
    gender: "m",
    country: "GB",
    accountDaysAgo: 2,
    note: "an account with no order at all, to edit and then delete",
  },
  {
    key: "emma-larsen",
    first: "Emma",
    last: "Larsen",
    gender: "f",
    country: "CA",
    accountDaysAgo: 20.5,
    service: "bank-only",
    stage: "awaiting_bank",
    createdDaysAgo: 20.3,
    paidDaysAgo: 20,
    session: "test",
    people: ["self"],
    answers: false,
    docs: "all-approved",
    contract: true,
    note: "with the bank, every document approved, bought from the client area so it carries no wizard answers",
  },
];

/** Where each answer key is stored in user_answers, as seed-demo has it. */
const QUESTION_KEY_BY_ANSWER = {
  residence: "residence",
  applicants: "who",
  hasNif: "has-nif",
  bank: "bank",
  passport: "passport",
  visa: "visa",
};

// ---------------------------------------------------------------------------
// Placeholder PDF
// ---------------------------------------------------------------------------

/** A one page PDF that says what it stands in for and that it is not real. */
async function placeholderPdf(title, lines) {
  const doc = await PDFDocument.create();
  doc.setTitle(safeText(`Sample for training: ${title}`));
  doc.setProducer("scripts/seed-history.mjs");
  const page = doc.addPage([595.28, 841.89]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(SAMPLE_STAMP, { x: 48, y: 780, size: 13, font: bold });
  page.drawText(safeText(title), { x: 48, y: 740, size: 17, font: bold });
  let y = 706;
  for (const line of [
    "Placeholder written by scripts/seed-history.mjs for training and testing.",
    "It belongs to no real person and proves nothing.",
    "",
    ...lines,
  ]) {
    page.drawText(safeText(line), { x: 48, y, size: 11, font });
    y -= 18;
  }
  page.drawText(SAMPLE_STAMP, { x: 48, y: 64, size: 11, font: bold });
  return await doc.save();
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function readS3Config() {
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

/** The object's size, or null when it is not there. */
async function headSize(r2, key) {
  try {
    const head = await r2.client.send(new HeadObjectCommand({ Bucket: r2.bucket, Key: key }));
    return typeof head.ContentLength === "number" ? head.ContentLength : null;
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    if (status === 404 || error?.name === "NotFound" || error?.name === "NoSuchKey") return null;
    throw error;
  }
}

async function listPrefix(r2, prefix) {
  const keys = [];
  let token;
  do {
    const page = await r2.client.send(
      new ListObjectsV2Command({ Bucket: r2.bucket, Prefix: prefix, ContinuationToken: token }),
    );
    for (const item of page.Contents ?? []) if (item.Key) keys.push(item.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

// ---------------------------------------------------------------------------
// Database reads
// ---------------------------------------------------------------------------

async function readAll(supabase, table, columns, filter) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select(columns).order("id", { ascending: true });
    if (filter) query = filter(query);
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) fail(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

async function readByOrders(supabase, table, columns, orderIds) {
  const rows = [];
  for (const part of chunks(orderIds)) {
    rows.push(...(await readAll(supabase, table, columns, (q) => q.in("user_service_id", part))));
  }
  return rows;
}

async function listAuthUsers(supabase) {
  const all = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`listUsers: ${error.message}`);
    all.push(...data.users);
    if (data.users.length < 200) break;
  }
  return all;
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

/**
 * What a reset would take: every client account with everything it owns,
 * plus auth users that never got a profile. Never an admin.
 */
async function planReset(supabase, r2) {
  const profiles = await readAll(supabase, "users", "id, email, role");
  const authUsers = await listAuthUsers(supabase);
  const orders = await readAll(
    supabase,
    "user_services",
    "id, user_id, stripe_checkout_session_id, paid_at, total_cents, created_at",
  );

  const liveOrders = orders.filter((o) => String(o.stripe_checkout_session_id ?? "").startsWith("cs_live_"));

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const accounts = [];
  for (const profile of profiles) {
    if ((profile.role ?? "client") === "admin") continue;
    accounts.push({ id: profile.id, email: profile.email, profile: true, auth: false });
  }
  const byId = new Map(accounts.map((a) => [a.id, a]));
  for (const user of authUsers) {
    const known = byId.get(user.id);
    if (known) {
      known.auth = true;
      continue;
    }
    if (profileById.has(user.id)) continue; // an admin's auth user: left alone
    accounts.push({ id: user.id, email: user.email ?? "(no email)", profile: false, auth: true, orphan: true });
  }

  const doomedIds = new Set(accounts.map((a) => a.id));
  const doomedOrders = orders.filter((o) => doomedIds.has(o.user_id));
  const orderIds = doomedOrders.map((o) => o.id);

  const [events, documents, applicants, contracts, deliverables] = await Promise.all([
    readByOrders(supabase, "user_service_events", "id", orderIds),
    readByOrders(supabase, "user_documents", "id, storage_key", orderIds),
    readByOrders(supabase, "user_service_applicants", "id", orderIds),
    readByOrders(supabase, "user_service_contracts", "id, storage_key", orderIds),
    readByOrders(supabase, "user_service_deliverables", "id, storage_key", orderIds),
  ]);

  let answers = 0;
  for (const part of chunks([...doomedIds])) {
    answers += (await readAll(supabase, "user_answers", "id", (q) => q.in("user_id", part))).length;
  }

  // Files: the keys the rows name, plus whatever the bucket itself holds
  // under the three folders of each order. The union, like
  // scripts/purge-test-data.mjs, so an upload that was never confirmed (an
  // object with no row) goes too and a listing that comes back short can
  // never lose the keys the rows do name.
  const fileKeys = new Set(
    [...documents, ...contracts, ...deliverables].map((row) => row.storage_key).filter(Boolean),
  );
  if (r2) {
    await pool(orderIds, 4, async (orderId) => {
      for (const prefix of [`orders/${orderId}/`, `deliverables/${orderId}/`, `contracts/${orderId}/`]) {
        for (const key of await listPrefix(r2, prefix)) fileKeys.add(key);
      }
    });
  }

  return {
    accounts,
    orders: doomedOrders,
    orderIds,
    liveOrders,
    fileKeys,
    counts: {
      user_services: orderIds.length,
      user_service_events: events.length,
      user_documents: documents.length,
      user_service_applicants: applicants.length,
      user_service_contracts: contracts.length,
      user_service_deliverables: deliverables.length,
      user_answers: answers,
      "users (profiles)": accounts.filter((a) => a.profile).length,
      "auth users": accounts.filter((a) => a.auth).length,
      "bucket objects": fileKeys.size,
    },
  };
}

/** Deletes what planReset found, in the order deleteClientAccount uses. */
async function runReset(supabase, r2, plan) {
  // 1. Files first: a bucket that cannot be reached stops us with the rows
  //    still in place, rather than leaving files nothing points at. The keys
  //    are the ones planReset collected (rows and listing), listed once more
  //    here in case something arrived in between.
  let filesDeleted = 0;
  if (r2) {
    const keys = new Set(plan.fileKeys);
    await pool(plan.orderIds, 4, async (orderId) => {
      for (const prefix of [`orders/${orderId}/`, `deliverables/${orderId}/`, `contracts/${orderId}/`]) {
        for (const key of await listPrefix(r2, prefix)) keys.add(key);
      }
    });
    await pool([...keys], UPLOAD_CONCURRENCY, async (key) => {
      await r2.client.send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: key }));
      filesDeleted += 1;
    });
  }

  // 2. Leaves, then the order.
  const childTables = [
    "user_service_events",
    "user_documents",
    "user_service_applicants",
    "user_service_contracts",
    "user_service_deliverables",
  ];
  for (const part of chunks(plan.orderIds)) {
    for (const table of childTables) {
      const { error } = await supabase.from(table).delete().in("user_service_id", part);
      if (error) fail(`${table}: ${error.message}`);
    }
    const { error } = await supabase.from("user_services").delete().in("id", part);
    if (error) fail(`user_services: ${error.message}`);
  }

  const accountIds = plan.accounts.map((a) => a.id);

  // 3. Answers (user_id is on delete restrict, so they go before the profile).
  for (const part of chunks(accountIds)) {
    const { error } = await supabase.from("user_answers").delete().in("user_id", part);
    if (error) fail(`user_answers: ${error.message}`);
  }

  // 4. A doomed account still named on a row that stays (an admin's order)
  //    would block the profile delete. Clear those pointers and say so.
  let cleared = 0;
  for (const [table, column] of [
    ["user_service_events", "actor_id"],
    ["user_documents", "reviewed_by"],
    ["user_service_deliverables", "uploaded_by"],
  ]) {
    for (const part of chunks(accountIds)) {
      const { data, error } = await supabase
        .from(table)
        .update({ [column]: null })
        .in(column, part)
        .select("id");
      if (error) fail(`${table}.${column}: ${error.message}`);
      cleared += (data ?? []).length;
    }
  }

  // 5. The profile, then the auth user.
  let accountsDeleted = 0;
  for (const account of plan.accounts) {
    if (account.profile) {
      const { error } = await supabase.from("users").delete().eq("id", account.id);
      if (error) fail(`users ${account.email}: ${error.message}`);
    }
    if (account.auth) {
      const { error } = await supabase.auth.admin.deleteUser(account.id);
      if (error) fail(`auth user ${account.email}: ${error.message}`);
    }
    accountsDeleted += 1;
  }

  return { filesDeleted, accountsDeleted, cleared };
}

// ---------------------------------------------------------------------------
// The catalogue, read from the database
// ---------------------------------------------------------------------------

async function readCatalogue(supabase) {
  const services = await check("services", supabase.from("services").select("*"));
  const stages = await check("service_stages", supabase.from("service_stages").select("*"));
  const docs = await check("service_docs", supabase.from("service_docs").select("*"));
  const deliverables = await check("service_deliverables", supabase.from("service_deliverables").select("*"));
  const questions = await check("questions", supabase.from("questions").select("key"));

  const bySlug = new Map();
  for (const service of services) {
    const own = stages.filter((s) => s.service_id === service.id).sort((a, b) => a.position - b.position);
    bySlug.set(service.slug, {
      service,
      stages: own,
      terminal: own.find((s) => s.is_terminal) ?? own[own.length - 1],
      docs: docs.filter((d) => d.service_id === service.id).sort((a, b) => a.position - b.position),
      deliverables: deliverables
        .filter((d) => d.service_id === service.id)
        .sort((a, b) => a.position - b.position),
    });
  }
  const questionKeys = new Set(questions.map((q) => q.key));
  return { bySlug, questionKeys };
}

// ---------------------------------------------------------------------------
// Answers, as the wizard would have stored them
// ---------------------------------------------------------------------------

function answersFor(slug, country, rnd) {
  const eea = COUNTRIES[country]?.eea ?? false;
  const visas = ["d7", "d8", "d2", "d1"];
  if (slug === "couple") {
    return {
      residence: country,
      applicants: "two",
      hasNif: [false, false],
      bank: "joint",
      passport: [country, country],
      ...(eea ? {} : { visa: pick(rnd, visas) }),
    };
  }
  if (slug === "bank-only") {
    return {
      residence: country,
      applicants: "one",
      hasNif: [true],
      bank: "yes",
      passport: [country],
      ...(eea ? {} : { visa: pick(rnd, visas) }),
    };
  }
  if (slug === "bundle") {
    return {
      residence: country,
      applicants: "one",
      hasNif: [false],
      bank: "yes",
      passport: [country],
      ...(eea ? {} : { visa: pick(rnd, visas) }),
    };
  }
  return {
    residence: country,
    applicants: "one",
    hasNif: [false],
    bank: "no",
    passport: [country],
  };
}

// ---------------------------------------------------------------------------
// Building the dataset
// ---------------------------------------------------------------------------

/**
 * The whole plan, as plain data: accounts to make, orders to write, rows per
 * table and files to put in the bucket. Nothing here touches the network,
 * so the dry run builds exactly what --apply would.
 */
function buildPlan(catalogue) {
  const rndPeople = stream("people");
  const rndOrders = stream("orders");
  const rndDocs = stream("documents");

  const accounts = [];
  const orders = [];
  const warnings = [];

  const accountByKey = new Map();
  function addAccount(key, first, last, gender, country, createdAt, details) {
    const email = emailFor(first, last);
    if (accountByKey.has(email)) fail(`Two accounts would share ${email}.`);
    const account = {
      key,
      email,
      fullName: `${first} ${last}`,
      phone: null,
      createdAt,
      details: details ?? personDetails(first, last, gender, country, rndPeople),
      country,
    };
    accountByKey.set(email, account);
    accounts.push(account);
    return account;
  }

  // --- The generated buyers ------------------------------------------------
  const span = ANCHOR - monthStart(0).getTime();
  NAMES.forEach(([first, last, gender, country], index) => {
    // Spread over the window, the first four in the opening month so the
    // oldest orders always have someone to belong to.
    const share = index < 4 ? rndPeople() * 0.03 : (index + 1) / (NAMES.length + 2);
    const jitter = (rndPeople() - 0.5) * (span / NAMES.length);
    const at = notAfterNow(new Date(monthStart(0).getTime() + share * span + jitter));
    const account = addAccount(`gen-${slugify(`${first}-${last}`)}`, first, last, gender, country, at);
    const info = COUNTRIES[country];
    account.phone = `${info.phone}${String(100 + index).slice(-3)}`;
    account.slot = at.getTime();
    // Everyone has a partner on file, used only when they buy the Couple
    // package: that order needs a second applicant with their own deed.
    const partnerGender = gender === "f" ? "m" : "f";
    account.partnerDetails = personDetails(
      pick(rndPeople, PARTNER_NAMES[partnerGender]),
      last,
      partnerGender,
      country,
      rndPeople,
    );
  });
  accounts.sort((a, b) => a.slot - b.slot);

  // --- The named fixtures --------------------------------------------------
  const fixtureAccounts = new Map();
  for (const fixture of FIXTURES) {
    const at = notAfterNow(daysAgo(fixture.accountDaysAgo));
    const account = addAccount(
      `fix-${fixture.key}`,
      fixture.first,
      fixture.last,
      fixture.gender,
      fixture.country,
      at,
    );
    account.phone = `${COUNTRIES[fixture.country].phone}${String(900 + FIXTURES.indexOf(fixture)).slice(-3)}`;
    account.fixture = fixture.key;
    fixtureAccounts.set(fixture.key, account);
    if (fixture.partner) {
      account.partnerDetails = personDetails(
        fixture.partner.first,
        fixture.partner.last,
        fixture.partner.gender,
        fixture.partner.country,
        rndPeople,
      );
    }
  }

  // --- The generated orders, month by month --------------------------------
  /** One paid order in every calendar month, so no month of the charts is empty. */
  const plans = [];
  for (let month = 0; month < MONTH_COUNT; month += 1) {
    const at = dateInMonth(month, rndOrders);
    // A completed order needs room for its 2 to 8 weeks of work, so the
    // newest months carry an order that is still in progress instead.
    const kind = at.getTime() <= ANCHOR - 16 * DAY ? "completed" : "inProgress";
    plans.push({ kind, createdAt: at, spine: true });
  }

  const spineCompleted = plans.filter((p) => p.kind === "completed").length;
  const spineInProgress = plans.length - spineCompleted;

  for (let i = 0; i < Math.max(0, TARGET.completed - spineCompleted); i += 1) {
    let at = dateInMonth(recentMonth(rndOrders, 0.35), rndOrders);
    const latest = ANCHOR - 16 * DAY;
    if (at.getTime() > latest) at = new Date(latest - rndOrders() * 20 * DAY);
    plans.push({ kind: "completed", createdAt: at });
  }

  // In progress: mostly the last weeks, a few older ones left running.
  for (let i = 0; i < Math.max(0, TARGET.inProgress - spineInProgress); i += 1) {
    const bucket = weighted(rndOrders, [
      ["recent", 12],
      ["mid", 4],
      ["old", 1],
    ]);
    const daysBack =
      bucket === "recent"
        ? between(rndOrders, 1.2, 55)
        : bucket === "mid"
          ? between(rndOrders, 56, 170)
          : between(rndOrders, 171, 330);
    plans.push({ kind: "inProgress", createdAt: notAfterNow(daysAgo(daysBack)) });
  }

  // Unpaid: most of them this month, three abandoned long ago.
  for (let i = 0; i < TARGET.unpaid; i += 1) {
    const old = i >= TARGET.unpaid - 3;
    const daysBack = old ? between(rndOrders, 180, 580) : between(rndOrders, 0.6, 31);
    plans.push({ kind: "unpaid", createdAt: notAfterNow(daysAgo(daysBack)) });
  }

  plans.sort((a, b) => a.createdAt - b.createdAt);

  let previous = null;
  plans.forEach((entry, index) => {
    const slug = weighted(rndOrders, SERVICE_WEIGHTS);
    const eligible = accounts.filter((a) => !a.fixture && a.slot <= entry.createdAt.getTime());
    const candidates = eligible.length > 0 ? eligible : accounts.filter((a) => !a.fixture).slice(0, 4);
    // One buyer in five comes back for a second service.
    const account =
      previous && candidates.includes(previous) && rndOrders() < 0.2
        ? previous
        : pick(rndOrders, candidates);
    previous = account;
    orders.push(
      buildOrder({
        key: `gen-${String(index + 1).padStart(3, "0")}`,
        account,
        slug,
        kind: entry.kind,
        createdAt: entry.createdAt,
        catalogue,
        rndOrders,
        rndDocs,
        warnings,
      }),
    );
  });

  // --- The fixture orders --------------------------------------------------
  for (const fixture of FIXTURES) {
    if (!fixture.service) continue;
    const account = fixtureAccounts.get(fixture.key);
    orders.push(
      buildFixtureOrder({ fixture, account, catalogue, rndDocs, warnings }),
    );
  }

  // The profile can never be younger than its first order.
  const firstOrder = new Map();
  for (const order of orders) {
    const at = order.createdAt.getTime();
    const known = firstOrder.get(order.account.email);
    if (known === undefined || at < known) firstOrder.set(order.account.email, at);
  }
  for (const account of accounts) {
    const first = firstOrder.get(account.email);
    if (first !== undefined && account.createdAt.getTime() > first - HOUR) {
      account.createdAt = new Date(first - HOUR);
    }
  }

  return { accounts, orders, warnings };
}

/** The stages an order has walked, with plausible dates between them. */
function stageHistory(spec) {
  const { stages, targetKey, createdAt, paidAt, endAt, rnd } = spec;
  const target = stages.find((s) => s.key === targetKey);
  const path = stages.filter((s) => s.position <= target.position);
  const events = [{ from: null, to: path[0].key, at: createdAt, note: SEED_NOTE }];
  if (!paidAt || path.length < 2) return events;

  events.push({ from: path[0].key, to: path[1].key, at: paidAt, note: null });
  const later = path.slice(2);
  if (later.length === 0) return events;

  // Documents land a few days after payment, then one stage at a time.
  const start = addDays(paidAt, between(rnd, 2, 6));
  const end = notAfterNow(endAt ?? addDays(paidAt, between(rnd, 10, 40)));
  const total = Math.max(HOUR, end.getTime() - start.getTime());
  let previousKey = path[1].key;
  later.forEach((stage, index) => {
    const share = (index + 1) / later.length;
    const wobble = (rnd() - 0.5) * (total / (later.length * 3));
    const at = notAfterNow(new Date(Math.min(end.getTime(), start.getTime() + total * share + wobble)));
    events.push({ from: previousKey, to: stage.key, at, note: null });
    previousKey = stage.key;
  });
  return events;
}

function buildOrder(input) {
  const { key, account, slug, kind, createdAt, catalogue, rndOrders, rndDocs, warnings } = input;
  const entry = catalogue.bySlug.get(slug) ?? fail(`Service ${slug} is missing.`);
  const stages = entry.stages;
  const joint = slug === "couple";

  const paidAt = kind === "unpaid" ? null : notAfterNow(addDays(createdAt, between(rndOrders, 0.01, 0.4)));
  let stageKey = stages[0].key;
  let endAt = null;
  let completed = false;

  if (kind === "completed") {
    stageKey = entry.terminal.key;
    const worked = between(rndOrders, 14, 56);
    endAt = notAfterNow(new Date(Math.min(ANCHOR - 0.5 * DAY, addDays(paidAt, worked).getTime())));
    completed = true;
  } else if (kind === "inProgress") {
    const middle = stages.filter((s) => s.position > stages[0].position && !s.is_terminal);
    const target = middle.length > 0 ? pick(rndOrders, middle) : stages[1];
    stageKey = target.key;
    endAt = notAfterNow(daysAgo(between(rndOrders, 0.6, 4)));
  }

  const events = stageHistory({ stages, targetKey: stageKey, createdAt, paidAt, endAt, rnd: rndOrders });
  const lastMove = events[events.length - 1].at;

  const withAnswers = rndOrders() > 0.25;
  const session = paidAt ? rndOrders() > 0.18 : rndOrders() > 0.55;

  const order = {
    key,
    account,
    slug,
    entry,
    joint,
    applicants: joint ? 2 : 1,
    createdAt,
    paidAt,
    completedAt: completed ? lastMove : null,
    stageKey,
    events,
    session,
    answers: withAnswers ? answersFor(slug, account.country, rndOrders) : null,
    people: paidAt ? (joint ? ["self", "partner"] : ["self"]) : [],
    report: completed ? pick(rndOrders, REPORTS) : null,
    docs: null,
    deliverables: [],
  };

  if (paidAt) {
    const stageIndex = stages.findIndex((s) => s.key === stageKey);
    const documentsIndex = stages.findIndex((s) => s.key === "documents");
    if (documentsIndex >= 0 && stageIndex === documentsIndex) {
      order.docs = mixedDocs(entry.docs, order.applicants, rndDocs);
    } else if (stageIndex > 0) {
      // Past the documents stage every required slot must be approved: since
      // 2026-09-22 advanceStage refuses to leave it otherwise, so an order
      // that got further can only look this way.
      order.docs = "all-approved";
    }

    // Deliverables: everything on a completed order, a partial set once the
    // order is one stage away from the end.
    const templates = entry.deliverables;
    const terminalIndex = stages.indexOf(entry.terminal);
    if (completed) {
      order.deliverables = templates.map((t) => t.key);
    } else if (templates.length > 0 && stageIndex >= terminalIndex - 1) {
      const howMany = Math.max(1, templates.length - 1);
      order.deliverables = templates.slice(0, howMany).map((t) => t.key);
    }
  }

  if (!stages.some((s) => s.key === stageKey)) warnings.push(`${key}: ${slug} has no stage ${stageKey}`);
  return order;
}

/** A documents stage order: some approved, some waiting, one rejected, some empty. */
function mixedDocs(docs, applicants, rnd) {
  const plan = {};
  for (const doc of docs) {
    const slots = doc.per_applicant ? applicants : 1;
    plan[doc.key] = Array.from({ length: slots }, () => {
      const roll = rnd();
      if (roll < 0.42) return "approved";
      if (roll < 0.74) return "uploaded";
      if (roll < 0.86) return { status: "rejected", reason: pick(rnd, REJECTION_REASONS) };
      return null;
    });
  }
  return plan;
}

function buildFixtureOrder(input) {
  const { fixture, account, catalogue, rndDocs, warnings } = input;
  const entry = catalogue.bySlug.get(fixture.service) ?? fail(`Service ${fixture.service} is missing.`);
  const stages = entry.stages;
  const joint = fixture.service === "couple";
  const stageKey = fixture.stage === "terminal" ? entry.terminal.key : fixture.stage;

  if (!stages.some((s) => s.key === stageKey)) {
    fail(`Fixture ${fixture.key}: ${fixture.service} has no stage "${stageKey}". Stages: ${stages.map((s) => s.key).join(", ")}`);
  }
  const target = stages.find((s) => s.key === stageKey);
  if (fixture.stage !== "terminal" && fixture.stage !== "awaiting_payment" && target.is_terminal) {
    warnings.push(
      `${fixture.key}: ${fixture.service}'s stage "${stageKey}" is the terminal one in this project, so the order reads as finished although the checklist expects work left.`,
    );
  }

  const createdAt = notAfterNow(daysAgo(fixture.createdDaysAgo));
  const paidAt = fixture.paidDaysAgo === undefined ? null : notAfterNow(daysAgo(fixture.paidDaysAgo));
  const endAt = fixture.endDaysAgo === undefined ? null : notAfterNow(daysAgo(fixture.endDaysAgo));
  const rnd = stream(`fixture:${fixture.key}`);
  const events = stageHistory({ stages, targetKey: stageKey, createdAt, paidAt, endAt, rnd });
  const lastMove = events[events.length - 1].at;

  let docs = fixture.docs ?? null;
  if (docs === "all-uploaded") {
    docs = {};
    for (const doc of entry.docs) {
      docs[doc.key] = Array.from({ length: doc.per_applicant ? (joint ? 2 : 1) : 1 }, () => "uploaded");
    }
  }

  return {
    key: `fix-${fixture.key}`,
    fixture: fixture.key,
    account,
    slug: fixture.service,
    entry,
    joint,
    applicants: joint ? 2 : 1,
    createdAt,
    paidAt,
    completedAt: target.is_terminal && paidAt ? lastMove : null,
    stageKey,
    events,
    session: fixture.session === "test",
    answers: fixture.answers ? answersFor(fixture.service, account.country, rnd) : null,
    people: paidAt ? (fixture.people ?? []) : [],
    report: fixture.reportIndex === undefined ? null : REPORTS[fixture.reportIndex],
    docs,
    deliverables:
      fixture.deliverables === "all" ? entry.deliverables.map((t) => t.key) : (fixture.deliverables ?? []),
    contractWanted: fixture.contract === true,
    note: fixture.note,
  };
}

// ---------------------------------------------------------------------------
// Turning the plan into rows and files
// ---------------------------------------------------------------------------

/**
 * Rows per table and the files they point at. `files` carry a lazy `make()`
 * so the dry run never builds a PDF, and `patch` so the real byte length can
 * be written into the row once the object is in the bucket.
 */
function materialise(plan, catalogue, contracts, userIdByEmail) {
  const rows = {
    user_answers: [],
    user_services: [],
    user_service_events: [],
    user_service_applicants: [],
    user_documents: [],
    user_service_deliverables: [],
    user_service_contracts: [],
  };
  const files = [];
  const orderIds = new Set();
  const notes = [];

  for (const order of plan.orders) {
    const orderId = historyId(`order:${order.key}`);
    orderIds.add(orderId);
    const userId = userIdByEmail.get(order.account.email) ?? null;
    const service = order.entry.service;
    const submissionId = order.answers ? historyId(`submission:${order.key}`) : null;

    rows.user_services.push({
      id: orderId,
      user_id: userId,
      service_id: service.id,
      submission_id: submissionId,
      answers_snapshot: order.answers ?? {},
      joint: order.joint,
      applicants: order.applicants,
      total_cents: service.price_cents,
      currency: service.currency || "eur",
      stage_key: order.stageKey,
      stripe_checkout_session_id: order.session ? testSessionId(orderId) : null,
      stripe_payment_intent_id: order.session && order.paidAt ? testPaymentIntentId(orderId) : null,
      paid_at: order.paidAt ? iso(order.paidAt) : null,
      completed_at: order.completedAt ? iso(order.completedAt) : null,
      report: order.report,
      created_at: iso(order.createdAt),
    });

    order.events.forEach((event, index) => {
      rows.user_service_events.push({
        id: historyId(`event:${order.key}:${index}`),
        user_service_id: orderId,
        from_stage: event.from,
        to_stage: event.to,
        note: event.note,
        actor_id: null,
        created_at: iso(event.at),
      });
    });

    if (order.answers) {
      for (const [answerKey, value] of Object.entries(order.answers)) {
        const questionKey = QUESTION_KEY_BY_ANSWER[answerKey];
        if (!questionKey || !catalogue.questionKeys.has(questionKey)) continue;
        rows.user_answers.push({
          id: historyId(`answer:${order.key}:${questionKey}`),
          user_id: userId,
          submission_id: submissionId,
          question_key: questionKey,
          answer: value,
          created_at: iso(order.createdAt),
        });
      }
    }

    // Applicant details, one row per person on a paid order.
    const details = [];
    order.people.forEach((who, index) => {
      const source = who === "partner" ? order.account.partnerDetails : order.account.details;
      if (!source) return;
      const row = {
        id: historyId(`applicant:${order.key}:${index}`),
        user_service_id: orderId,
        applicant_index: index,
        ...source,
        created_at: iso(notAfterNow(addDays(order.paidAt ?? order.createdAt, 0.05))),
      };
      details[index] = row;
      rows.user_service_applicants.push(row);
    });

    // Documents.
    if (order.docs && order.paidAt) {
      let offset = 0;
      for (const doc of order.entry.docs) {
        const slots = doc.per_applicant ? order.applicants : 1;
        const planned =
          order.docs === "all-approved" ? Array(slots).fill("approved") : (order.docs[doc.key] ?? []);
        for (let index = 0; index < slots; index += 1) {
          const entries = toAttempts(planned[index]);
          entries.forEach((attempt, attemptIndex) => {
            const rowId = historyId(`document:${order.key}:${doc.key}:${index}:${attemptIndex}`);
            const uploadedAt = notAfterNow(
              addDays(order.paidAt, 1 + offset * 0.04 + attemptIndex * 0.9),
            );
            const reviewedAt =
              attempt.status === "approved" || attempt.status === "rejected"
                ? notAfterNow(addDays(uploadedAt, 0.3))
                : null;
            const person = details[index]?.full_name ?? order.account.fullName;
            const key = `orders/${orderId}/${doc.key}/${index}/${rowId}.pdf`;
            const row = {
              id: rowId,
              user_service_id: orderId,
              service_doc_id: doc.id,
              applicant_index: index,
              storage_key: key,
              file_name: `${doc.key.replace(/_/g, "-")}-${slugify(person)}.pdf`,
              mime_type: "application/pdf",
              size_bytes: 1,
              status: attempt.status,
              rejection_reason: attempt.status === "rejected" ? attempt.reason : null,
              uploaded_at: iso(uploadedAt),
              reviewed_at: reviewedAt ? iso(reviewedAt) : null,
              reviewed_by: null,
              created_at: iso(new Date(uploadedAt.getTime() - 60 * 1000)),
            };
            rows.user_documents.push(row);
            files.push({
              key,
              patch: [(size) => (row.size_bytes = size)],
              make: () =>
                placeholderPdf(doc.label, [
                  `Order ${orderId}`,
                  `Client: ${person}`,
                  `Slot: ${doc.key}, applicant ${index}`,
                  `Service: ${service.name}`,
                ]),
            });
            offset += 1;
          });
        }
      }
    }

    // Deliverables the firm sent back.
    for (const templateKey of order.deliverables) {
      const template = order.entry.deliverables.find((t) => t.key === templateKey);
      if (!template) {
        notes.push(`${order.key}: ${order.slug} has no deliverable "${templateKey}", skipped`);
        continue;
      }
      const rowId = historyId(`deliverable:${order.key}:${templateKey}`);
      const key = `deliverables/${orderId}/${rowId}.pdf`;
      const lastMove = order.events[order.events.length - 1].at;
      const row = {
        id: rowId,
        user_service_id: orderId,
        service_deliverable_id: template.id,
        label: template.label,
        storage_key: key,
        status: "ready",
        file_name: `${templateKey.replace(/_/g, "-")}-${slugify(order.account.fullName)}.pdf`,
        mime_type: "application/pdf",
        size_bytes: 1,
        uploaded_by: null,
        created_at: iso(notAfterNow(addDays(lastMove, -0.1))),
      };
      rows.user_service_deliverables.push(row);
      files.push({
        key,
        patch: [(size) => (row.size_bytes = size)],
        make: () =>
          placeholderPdf(template.label, [
            `Order ${orderId}`,
            `Client: ${order.account.fullName}`,
            `Returned by the firm: ${templateKey}`,
          ]),
      });
    }

    // The service agreement, exactly as the platform prepares it after payment.
    const template = service.contract_template;
    const applicant = details[0] ?? null;
    const wanted = order.contractWanted ?? true;
    if (wanted && template && order.paidAt && applicant) {
      const generatedAt = notAfterNow(addDays(order.paidAt, 0.08));
      const key = `contracts/${orderId}/v1.pdf`;
      let values = {};
      let fileName = `service-agreement-${template}-${slugify(applicant.full_name)}.pdf`;
      if (contracts) {
        values = contracts.values({
          template,
          applicant,
          email: order.account.email,
          totalCents: service.price_cents,
          paidAt: iso(order.paidAt),
          signingPlace: null,
        });
        fileName = contracts.fileName(template, applicant.full_name);
      }
      const row = {
        id: historyId(`contract:${order.key}`),
        user_service_id: orderId,
        template,
        version: 1,
        storage_key: key,
        file_name: fileName,
        size_bytes: 1,
        variables: values,
        generated_at: iso(generatedAt),
        // Stamped, so the order reads as sent. sendEmail skips every
        // .invalid recipient, so nothing ever left.
        emailed_at: iso(generatedAt),
        created_at: iso(generatedAt),
      };
      rows.user_service_contracts.push(row);
      files.push({
        key,
        patch: [(size) => (row.size_bytes = size)],
        make: async () => {
          if (contracts) {
            return new Uint8Array(await contracts.generate(template, values, { reference: orderId }));
          }
          return placeholderPdf("Service agreement", [`Order ${orderId}`, `Model: ${template}`]);
        },
      });
    }

    order.id = orderId;
  }

  // Nothing is ever written outside the three folders of an order this run owns.
  const allowed = /^(orders|deliverables|contracts)\/([0-9a-f-]{36})\//;
  for (const file of files) {
    const match = allowed.exec(file.key);
    if (!match || !orderIds.has(match[2])) fail(`Refusing to write "${file.key}": not an order of this run.`);
  }

  return { rows, files, orderIds, notes };
}

/** One planned slot entry turned into the upload attempts it stands for. */
function toAttempts(entry) {
  if (!entry) return [];
  const list = Array.isArray(entry) ? entry : [entry];
  return list
    .map((item) => {
      if (typeof item === "string" && item.startsWith("rejected:")) {
        return { status: "rejected", reason: item.slice("rejected:".length) };
      }
      if (typeof item === "string") return { status: item };
      return item;
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function printDataset(plan, materialised, files, uploadSummary) {
  const byService = new Map();
  const byMonth = new Map();
  for (let i = 0; i < MONTH_COUNT; i += 1) byMonth.set(monthKeyOf(i), { paid: 0, open: 0, cents: 0 });

  let unpaid = 0;
  let completed = 0;
  let inProgress = 0;
  for (const order of plan.orders) {
    const entry = byService.get(order.slug) ?? { orders: 0, paid: 0, cents: 0 };
    entry.orders += 1;
    if (order.paidAt) {
      entry.paid += 1;
      entry.cents += order.entry.service.price_cents;
    }
    byService.set(order.slug, entry);

    if (!order.paidAt) {
      unpaid += 1;
      const bucket = byMonth.get(monthKeyOf(monthIndexOf(order.createdAt)));
      if (bucket) bucket.open += 1;
    } else {
      if (order.completedAt) completed += 1;
      else inProgress += 1;
      const bucket = byMonth.get(monthKeyOf(monthIndexOf(order.paidAt)));
      if (bucket) {
        bucket.paid += 1;
        bucket.cents += order.entry.service.price_cents;
      }
    }
  }

  console.log("Dataset");
  console.log(`  accounts                    ${String(plan.accounts.length).padStart(6)}`);
  console.log(`  orders                      ${String(plan.orders.length).padStart(6)}`);
  console.log(`    unpaid                    ${String(unpaid).padStart(6)}`);
  console.log(`    in progress               ${String(inProgress).padStart(6)}`);
  console.log(`    completed                 ${String(completed).padStart(6)}`);

  console.log("\nBy service");
  for (const [slug, entry] of [...byService.entries()].sort()) {
    console.log(
      `  ${slug.padEnd(12)} ${String(entry.orders).padStart(4)} orders  ${String(entry.paid).padStart(4)} paid  ` +
        `EUR ${(entry.cents / 100).toFixed(2).padStart(10)}`,
    );
  }

  console.log("\nBy month (paid orders / open orders / revenue)");
  let emptyMonths = 0;
  for (const [month, entry] of byMonth) {
    if (entry.paid === 0) emptyMonths += 1;
    console.log(
      `  ${month}   paid ${String(entry.paid).padStart(3)}   open ${String(entry.open).padStart(3)}   ` +
        `EUR ${(entry.cents / 100).toFixed(2).padStart(9)}${entry.paid === 0 ? "   <- no paid order" : ""}`,
    );
  }
  console.log(
    emptyMonths === 0
      ? "  every month carries at least one paid order and some revenue"
      : `  ${emptyMonths} month(s) carry no paid order`,
  );

  console.log("\nRows");
  for (const [table, list] of Object.entries(materialised.rows)) {
    console.log(`  ${table.padEnd(28)} ${String(list.length).padStart(6)}`);
  }
  console.log(`  ${"files in the bucket".padEnd(28)} ${String(files.length).padStart(6)}${uploadSummary ?? ""}`);
}

function printFixtures(plan, materialised) {
  console.log("\nNamed fixtures");
  for (const fixture of FIXTURES) {
    const account = plan.accounts.find((a) => a.fixture === fixture.key);
    const order = plan.orders.find((o) => o.fixture === fixture.key);
    console.log(`  ${account?.email ?? ""}`);
    if (!order) {
      console.log("    no order at all");
      console.log(`    ${fixture.note}`);
      continue;
    }

    const rows = materialised.rows;
    const documents = rows.user_documents.filter((d) => d.user_service_id === order.id);
    const byStatus = {};
    for (const row of documents) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    const slots = order.entry.docs.reduce(
      (sum, doc) => sum + (doc.per_applicant ? order.applicants : 1),
      0,
    );
    const filled = new Set(documents.map((d) => `${d.service_doc_id}:${d.applicant_index}`)).size;
    const agreement = rows.user_service_contracts.find((c) => c.user_service_id === order.id);
    const files = rows.user_service_deliverables.filter((d) => d.user_service_id === order.id);
    const applicants = rows.user_service_applicants.filter((a) => a.user_service_id === order.id);
    const events = rows.user_service_events.filter((e) => e.user_service_id === order.id);

    console.log(
      `    ${order.slug} | stage ${order.stageKey} | ${order.paidAt ? `paid ${String(iso(order.paidAt)).slice(0, 10)}` : "unpaid"}` +
        `${order.completedAt ? `, completed ${String(iso(order.completedAt)).slice(0, 10)}` : ""}`,
    );
    console.log(
      `    session ${order.session ? "cs_test_..." : "none"} | applicant details ${applicants.length} | ` +
        `events ${events.length} | agreement ${agreement ? `${agreement.template} v${agreement.version}, emailed` : "none"}`,
    );
    console.log(
      `    slots ${filled}/${slots} filled` +
        (documents.length
          ? ` (${Object.entries(byStatus)
              .map(([status, count]) => `${count} ${status}`)
              .join(", ")}${documents.length > filled ? `, ${documents.length - filled} superseded attempt(s)` : ""})`
          : "") +
        ` | deliverables ${files.length}/${order.entry.deliverables.length} | report ${order.report ? "yes" : "no"}`,
    );
    console.log(`    ${fixture.note}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  if (!url) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL (.env.local or the environment). Nothing was done.");
    process.exit(1);
  }
  const secret = env("SUPABASE_SECRET_KEY");
  if (!secret) {
    console.error("Missing SUPABASE_SECRET_KEY (.env.local or the environment). Nothing was done.");
    process.exit(1);
  }

  const supabase = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const r2 = readS3Config();

  const flags = [apply ? "--apply" : "dry run", reset && "--reset", includeLive && "--include-live"]
    .filter(Boolean)
    .join("  ");
  console.log(`\nTraining history on ${new URL(url).host}   [${flags}]`);
  console.log(`Window ${monthKeyOf(0)} to ${monthKeyOf(MONTH_COUNT - 1)} (${MONTH_COUNT} months), today ${iso(new Date(ANCHOR)).slice(0, 10)}\n`);
  if (!r2) console.warn("  ! S3_* variables missing: no file will be uploaded or removed.\n");

  // --- Catalogue -----------------------------------------------------------
  const catalogue = await readCatalogue(supabase);
  console.log("Catalogue (read from the project, not from the migrations)");
  for (const [slug, entry] of catalogue.bySlug) {
    console.log(
      `  ${slug.padEnd(11)} EUR ${(entry.service.price_cents / 100).toFixed(2).padStart(7)}  ` +
        `agreement: ${String(entry.service.contract_template ?? "none").padEnd(8)} ` +
        `${entry.docs.length} document slot(s), ${entry.deliverables.length} deliverable(s)`,
    );
    console.log(`    stages      ${entry.stages.map((s) => `${s.key}${s.is_terminal ? "*" : ""}`).join(" > ")}`);
    console.log(`    documents   ${entry.docs.map((d) => d.key).join(", ")}`);
    console.log(`    returns     ${entry.deliverables.map((d) => d.key).join(", ") || "(none)"}`);
  }
  console.log("  * terminal stage\n");

  // --- Reset ---------------------------------------------------------------
  let resetPlan = null;
  if (reset) {
    resetPlan = await planReset(supabase, r2);
    console.log("Reset: every client account and everything it owns");
    console.log(`  accounts to delete          ${String(resetPlan.accounts.length).padStart(6)}`);
    for (const [label, count] of Object.entries(resetPlan.counts)) {
      console.log(`  ${label.padEnd(28)} ${String(count).padStart(6)}`);
    }
    const shown = resetPlan.accounts.slice(0, 12);
    for (const account of shown) {
      console.log(`    ${account.email}${account.orphan ? "  (auth user with no profile)" : ""}`);
    }
    if (resetPlan.accounts.length > shown.length) {
      console.log(`    ... and ${resetPlan.accounts.length - shown.length} more`);
    }
    if (resetPlan.liveOrders.length > 0) {
      console.log(
        `\n  ! ${resetPlan.liveOrders.length} order(s) carry a live Stripe session (cs_live_): real customers.`,
      );
      for (const order of resetPlan.liveOrders.slice(0, 10)) {
        console.log(`    ${order.id}  ${String(order.created_at ?? "").slice(0, 10)}`);
      }
      if (includeLive) {
        console.log("    --include-live was passed, so they go too.");
      } else if (apply) {
        console.log("\nRefusing to reset without --include-live. Nothing was written or deleted.\n");
        process.exit(1);
      } else {
        console.log("    A reset would be refused without --include-live.");
      }
    }
    console.log("");
  }

  // --- The real agreement generator, with a placeholder to fall back on ----
  let contracts = null;
  try {
    const generate = await import("../src/lib/contracts/generate.ts");
    const variables = await import("../src/content/contracts/variables.ts");
    contracts = {
      generate: generate.generateContractPdf,
      values: variables.buildContractValues,
      fileName: variables.contractFileName,
    };
  } catch (error) {
    console.warn(`  ! Agreement generator unavailable (${error.message.split("\n")[0]}); placeholders instead.\n`);
  }

  // --- The plan ------------------------------------------------------------
  const plan = buildPlan(catalogue);

  // The applicant details must pass the rules the platform enforces.
  let rules = null;
  try {
    rules = await import("../src/lib/orders/applicant-rules.ts");
  } catch (error) {
    console.warn(`  ! Applicant rules unavailable (${error.message.split("\n")[0]}); details not re-checked.\n`);
  }
  if (rules) {
    for (const account of plan.accounts) {
      for (const details of [account.details, account.partnerDetails]) {
        if (!details) continue;
        const result = rules.validateApplicantInput(details);
        if (!result.ok) fail(`${account.email}: ${result.message}`);
      }
    }
  }

  // --- Reset, before anything is created ----------------------------------
  if (apply && reset && resetPlan) {
    const done = await runReset(supabase, r2, resetPlan);
    console.log(
      `Reset done: ${resetPlan.orderIds.length} order(s), ${done.filesDeleted} file(s), ` +
        `${done.accountsDeleted} account(s)${done.cleared ? `, ${done.cleared} reference(s) cleared` : ""}.\n`,
    );
  }

  // --- Accounts ------------------------------------------------------------
  const authUsers = await listAuthUsers(supabase);
  const authByEmail = new Map(authUsers.map((u) => [String(u.email ?? "").toLowerCase(), u]));
  const userIdByEmail = new Map();
  let created = 0;
  let existing = 0;

  for (const account of plan.accounts) {
    let user = authByEmail.get(account.email);
    if (user) {
      existing += 1;
    } else if (apply) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: account.email,
        email_confirm: true,
        user_metadata: { demo: true, full_name: account.fullName },
        app_metadata: { demo: true, seed: "history" },
      });
      if (error) fail(`createUser ${account.email}: ${error.message}`);
      user = data.user;
      created += 1;
    } else {
      created += 1;
    }
    // In a dry run an account that is not there yet gets a placeholder id;
    // nothing is written, so it never reaches the database.
    userIdByEmail.set(account.email, user?.id ?? historyId(`account:${account.email}`));
  }

  if (apply) {
    // The mirror trigger wrote (id, email); this names the profile, dates it
    // and makes sure it is a client.
    const profiles = plan.accounts.map((account) => ({
      id: userIdByEmail.get(account.email),
      email: account.email,
      full_name: account.fullName,
      phone: account.phone,
      created_at: iso(account.createdAt),
    }));
    for (const part of chunks(profiles, UPSERT_CHUNK)) {
      await check("users", supabase.from("users").upsert(part, { onConflict: "id" }));
    }
    for (const part of chunks(profiles.map((p) => p.id), UPSERT_CHUNK)) {
      const roles = await check("users roles", supabase.from("users").select("email, role").in("id", part));
      for (const row of roles) {
        if (row.role !== "client") fail(`${row.email} has role ${row.role}; a training account must be a client.`);
      }
    }
  }

  // --- Rows and files ------------------------------------------------------
  const materialised = materialise(plan, catalogue, contracts, userIdByEmail);

  if (!apply) {
    printDataset(plan, materialised, materialised.files, "  (not uploaded in a dry run)");
    printFixtures(plan, materialised);
    console.log(`\nAccounts: ${created} to create, ${existing} already there. All on ${DEMO_DOMAIN}.`);
    for (const warning of [...plan.warnings, ...materialised.notes]) console.log(`  ! ${warning}`);
    console.log(`\nNothing was written. Add --apply to write${reset ? " (--reset --apply wipes first)" : ""}.\n`);
    return;
  }

  // Files first, so no row ever points at a file that is not there.
  let uploaded = 0;
  let reused = 0;
  if (r2) {
    await pool(materialised.files, UPLOAD_CONCURRENCY, async (file) => {
      const known = await headSize(r2, file.key);
      let size = known;
      if (size === null || size === 0) {
        const body = await file.make();
        await r2.client.send(
          new PutObjectCommand({
            Bucket: r2.bucket,
            Key: file.key,
            Body: body,
            ContentType: "application/pdf",
            ContentLength: body.byteLength,
          }),
        );
        size = body.byteLength;
        uploaded += 1;
      } else {
        reused += 1;
      }
      for (const patch of file.patch) patch(size);
    });
  } else {
    // Rows still need a positive size_bytes; a one page placeholder is ~1 kB.
    for (const file of materialised.files) for (const patch of file.patch) patch(1024);
  }

  // Then the rows, parents before children.
  const conflictKeys = {
    user_service_applicants: "user_service_id,applicant_index",
    user_service_contracts: "user_service_id",
  };
  for (const [table, list] of Object.entries(materialised.rows)) {
    if (list.length === 0) continue;
    for (const part of chunks(list, UPSERT_CHUNK)) {
      await check(table, supabase.from(table).upsert(part, { onConflict: conflictKeys[table] ?? "id" }));
    }
  }

  printDataset(plan, materialised, materialised.files, `  (${uploaded} uploaded, ${reused} already there)`);
  printFixtures(plan, materialised);
  console.log(`\nAccounts: ${created} created, ${existing} already there. All on ${DEMO_DOMAIN}.`);
  for (const warning of [...plan.warnings, ...materialised.notes]) console.log(`  ! ${warning}`);
  console.log(`\nRemove it all with: npm run db:purge -- --demo --apply\n`);
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
