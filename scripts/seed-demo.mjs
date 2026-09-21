#!/usr/bin/env node
/**
 * Demo data for training and screenshots: four client accounts on the
 * reserved domain demo.alttavia.invalid and seven orders across the four
 * services, each at a different point of its life.
 *
 *   npm run demo:seed
 *
 * Runs under tsx (see package.json) because the service agreements are the
 * real ones: the same generator and the same values the platform uses
 * (src/lib/contracts/generate.ts, src/content/contracts/variables.ts), filled
 * with the demo names. Every other file is a one page placeholder that says
 * it is a demo file.
 *
 * What it makes, and what each one shows in /admin and in the client area:
 *
 *   ana@    NIF only, complete two days ago: every document approved, two
 *           deliverables ready, the agreement, a closing report.
 *   ana@    Bank Account only, documents stage: one upload waiting for review,
 *           one approved, one rejected with a reason, the rest empty.
 *   ana@    NIF only, awaiting payment (a second NIF, for someone else).
 *   ben@    NIF + Bank Account, issued documents delivery: wizard answers,
 *           every document approved, the agreement, two of three deliverables.
 *   ben@    NIF only, awaiting payment.
 *   carla@  Couple package, documents stage, two applicants: details for the
 *           first only, uploads on both sides. No agreement (no model yet).
 *   dora@   Bank Account only, awaiting the bank: every document approved,
 *           the agreement.
 *
 * Traceable: every account is on demo.alttavia.invalid, a domain that can
 * never receive mail (RFC 2606), so nothing is ever sent to a real person.
 * Nothing reaches Resend either: sendEmail (src/lib/email/send.ts) skips any
 * .invalid recipient and answers ok, so rejecting a demo file, completing a
 * demo order or sending a demo agreement during training bounces nothing
 * off the sending domain and reads in /admin as it would for a real client.
 * Every row id is derived from a fixed name ("alttavia-demo:<name>"), so
 * running the script again updates the same rows instead of adding new ones:
 * it is idempotent, and it also resets the seeded rows to their seeded state.
 * Rows made later by clicking around (a new upload, a stage move) stay; to
 * start over, run `npm run db:purge -- --demo --apply` and then this again.
 * Every file in the bucket lives under a key that contains /demo/.
 *
 * Nobody can sign in as these accounts by email: the code would go to a
 * domain that does not exist. They are there to be seen from /admin, and
 * from the client area through the sessions scripts/authz-matrix.mjs builds.
 *
 * Reads .env.local (the readEnvFile pattern of scripts/stripe-setup.mjs):
 * NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY for the database and the
 * Auth admin API; S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID,
 * S3_SECRET_ACCESS_KEY (S3_REGION optional) for the files. Without the S3
 * variables the rows are still written, the deliverables stay pending and
 * no file is uploaded. Nothing secret is printed.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const DEMO_DOMAIN = "demo.alttavia.invalid";

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

// ---------------------------------------------------------------------------
// Fixed ids
// ---------------------------------------------------------------------------

/**
 * A uuid that is always the same for the same name: sha256 of
 * "alttavia-demo:<name>", shaped as a version 5 uuid so every UUID check in
 * the routes accepts it.
 */
function demoId(name) {
  const bytes = createHash("sha256").update(`alttavia-demo:${name}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ---------------------------------------------------------------------------
// The demo, as data
// ---------------------------------------------------------------------------

const USERS = [
  { key: "ana", email: `ana@${DEMO_DOMAIN}`, fullName: "Ana Demo" },
  { key: "ben", email: `ben@${DEMO_DOMAIN}`, fullName: "Ben Demo" },
  { key: "carla", email: `carla@${DEMO_DOMAIN}`, fullName: "Carla Demo" },
  { key: "dora", email: `dora@${DEMO_DOMAIN}`, fullName: "Dora Demo" },
];

/** The nine fields of a deed, per person. Dates are YYYY-MM-DD, passports valid for years. */
const PEOPLE = {
  ana: {
    full_name: "Ana Demo",
    gender: "f",
    birth_place: "Austin, Texas, United States",
    birth_date: "1986-03-14",
    passport_number: "DEMO10001",
    passport_issuer: "United States Department of State",
    passport_issued_on: "2022-05-10",
    passport_expires_on: "2032-05-09",
    tax_address: "1200 Example Street, Austin, TX 78703, United States",
  },
  ben: {
    full_name: "Ben Demo",
    gender: "m",
    birth_place: "Chicago, Illinois, United States",
    birth_date: "1979-11-02",
    passport_number: "DEMO20002",
    passport_issuer: "United States Department of State",
    passport_issued_on: "2021-08-19",
    passport_expires_on: "2031-08-18",
    tax_address: "45 Sample Avenue, Chicago, IL 60614, United States",
  },
  carla: {
    full_name: "Carla Demo",
    gender: "f",
    birth_place: "Manchester, United Kingdom",
    birth_date: "1990-06-21",
    passport_number: "DEMO30003",
    passport_issuer: "HM Passport Office",
    passport_issued_on: "2023-02-01",
    passport_expires_on: "2033-02-01",
    tax_address: "7 Placeholder Road, Manchester M1 1AA, United Kingdom",
  },
  dora: {
    full_name: "Dora Demo",
    gender: "f",
    birth_place: "Toronto, Canada",
    birth_date: "1983-01-30",
    passport_number: "DEMO40004",
    passport_issuer: "Immigration, Refugees and Citizenship Canada",
    passport_issued_on: "2020-09-15",
    passport_expires_on: "2030-09-15",
    tax_address: "88 Example Lane, Toronto, ON M5V 2T6, Canada",
  },
};

const REJECTION_REASON = "The scan is too dark to read. Upload a clear copy of the full page.";

const REPORT =
  "Your NIF was issued and your Finanças access is active. Both documents are below. " +
  "Keep the Finanças password somewhere safe. Tax representation runs for 12 months from the issue date. " +
  "Write to us if anything in the documents looks wrong.";

/**
 * One entry per order. `docs` maps a service_docs key to one status per
 * applicant (null leaves the slot empty); "all-approved" fills every slot.
 * Days are counted back from now, so the demo always looks recent.
 */
const ORDERS = [
  {
    key: "ana-nif-completed",
    user: "ana",
    service: "nif-only",
    stage: "financas_access_ready",
    createdDaysAgo: 15,
    paidDaysAgo: 14.9,
    endDaysAgo: 2,
    people: ["ana"],
    docs: "all-approved",
    deliverables: ["nif_certificate", "financas_access"],
    contract: true,
    report: REPORT,
  },
  {
    key: "ana-bank-documents",
    user: "ana",
    service: "bank-only",
    stage: "documents",
    createdDaysAgo: 1.3,
    paidDaysAgo: 1.25,
    people: ["ana"],
    docs: {
      passport: ["uploaded"],
      nif_document: ["approved"],
      origin_tax_number: [{ status: "rejected", reason: REJECTION_REASON }],
    },
    contract: false,
  },
  {
    key: "ana-nif-unpaid",
    user: "ana",
    service: "nif-only",
    stage: "awaiting_payment",
    createdDaysAgo: 0.1,
  },
  {
    key: "ben-bundle-delivery",
    user: "ben",
    service: "bundle",
    stage: "issued_documents_delivery",
    createdDaysAgo: 17,
    paidDaysAgo: 16.9,
    endDaysAgo: 1,
    answers: {
      residence: "US",
      applicants: "one",
      hasNif: [false],
      bank: "yes",
      passport: ["US"],
      visa: "d7",
    },
    people: ["ben"],
    docs: "all-approved",
    deliverables: ["nif_certificate", "financas_access"],
    contract: true,
  },
  {
    key: "ben-nif-unpaid",
    user: "ben",
    service: "nif-only",
    stage: "awaiting_payment",
    createdDaysAgo: 1,
  },
  {
    key: "carla-couple-documents",
    user: "carla",
    service: "couple",
    stage: "documents",
    createdDaysAgo: 2.2,
    paidDaysAgo: 2,
    answers: {
      residence: "GB",
      applicants: "two",
      hasNif: [false, false],
      bank: "joint",
      passport: ["GB", "GB"],
      visa: "d8",
    },
    people: ["carla"],
    docs: {
      passport: ["uploaded", "uploaded"],
      proof_of_address: ["approved", null],
    },
    contract: false,
  },
  {
    key: "dora-bank-awaiting",
    user: "dora",
    service: "bank-only",
    stage: "awaiting_bank",
    createdDaysAgo: 10,
    paidDaysAgo: 9.9,
    endDaysAgo: 4,
    people: ["dora"],
    docs: "all-approved",
    contract: true,
  },
];

/** Where each answer key is stored in user_answers (public.questions key by answer_key). */
const QUESTION_KEY_BY_ANSWER = {
  residence: "residence",
  applicants: "who",
  hasNif: "has-nif",
  bank: "bank",
  passport: "passport",
  visa: "visa",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

function daysAgo(days) {
  return new Date(NOW - days * DAY);
}

function iso(date) {
  return date.toISOString();
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/** The earlier of a date and "an hour ago", so nothing seeded sits in the future. */
function notAfterNow(date) {
  const limit = NOW - 60 * 60 * 1000;
  return date.getTime() > limit ? new Date(limit) : date;
}

function fail(message) {
  throw new Error(message);
}

async function check(label, promise) {
  const { data, error } = await promise;
  if (error) fail(`${label}: ${error.message}`);
  return data;
}

/** Every auth user, a page at a time. */
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

/** A one page PDF that says what it stands in for and that it is a demo file. */
async function placeholderPdf(title, lines) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Demo file: ${title}`);
  doc.setProducer("scripts/seed-demo.mjs");
  const page = doc.addPage([595.28, 841.89]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("DEMO FILE", { x: 56, y: 760, size: 26, font: bold });
  page.drawText(title, { x: 56, y: 722, size: 16, font: bold });
  let y = 690;
  for (const line of [
    "Placeholder made by scripts/seed-demo.mjs for training and screenshots.",
    "It is not a real document and belongs to no real person.",
    "",
    ...lines,
  ]) {
    page.drawText(line, { x: 56, y, size: 11, font });
    y -= 18;
  }
  return await doc.save();
}

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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const secret = env("SUPABASE_SECRET_KEY");
  if (!url || !secret) {
    console.error("Missing in .env.local: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
    process.exit(1);
  }
  const supabase = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const r2 = readS3Config();

  // The real agreement generator, with a placeholder to fall back on.
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
    console.warn(`  ! Agreement generator unavailable (${error.message.split("\n")[0]}); placeholders instead.`);
  }

  console.log(`\nDemo data on ${new URL(url).host}\n`);

  // --- Catalogue -----------------------------------------------------------
  const services = await check("services", supabase.from("services").select("*"));
  const stages = await check("service_stages", supabase.from("service_stages").select("*"));
  const serviceDocs = await check("service_docs", supabase.from("service_docs").select("*"));
  const templates = await check("service_deliverables", supabase.from("service_deliverables").select("*"));
  const serviceBySlug = new Map(services.map((s) => [s.slug, s]));

  // --- Users ---------------------------------------------------------------
  const authUsers = await listAuthUsers(supabase);
  const authByEmail = new Map(authUsers.map((u) => [String(u.email ?? "").toLowerCase(), u]));
  const userIds = {};
  const userLines = [];
  for (const demo of USERS) {
    let user = authByEmail.get(demo.email);
    let action = "existing";
    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: demo.email,
        email_confirm: true,
        user_metadata: { demo: true, full_name: demo.fullName },
        app_metadata: { demo: true },
      });
      if (error) fail(`createUser ${demo.email}: ${error.message}`);
      user = data.user;
      action = "created";
    }
    // The mirror trigger made the profile; this names it and makes sure it is a client.
    await check(
      `users ${demo.email}`,
      supabase
        .from("users")
        .upsert({ id: user.id, email: demo.email, full_name: demo.fullName }, { onConflict: "id" }),
    );
    const profile = await check(
      `users ${demo.email}`,
      supabase.from("users").select("role").eq("id", user.id).single(),
    );
    if (profile.role !== "client") fail(`${demo.email} has role ${profile.role}; a demo account must be a client.`);
    userIds[demo.key] = user.id;
    userLines.push(`  ${action.padEnd(9)} ${demo.email}`);
  }
  console.log("Accounts");
  console.log(userLines.join("\n"));

  // --- Rows ----------------------------------------------------------------
  const rows = {
    user_answers: [],
    user_services: [],
    user_service_events: [],
    user_service_applicants: [],
    user_documents: [],
    user_service_deliverables: [],
    user_service_contracts: [],
  };
  const files = []; // { key, body, note }
  const orderLines = [];

  for (const spec of ORDERS) {
    const service = serviceBySlug.get(spec.service) ?? fail(`Service ${spec.service} is missing.`);
    const ownStages = stages
      .filter((s) => s.service_id === service.id)
      .sort((a, b) => a.position - b.position);
    const target = ownStages.find((s) => s.key === spec.stage) ?? fail(`${spec.service} has no stage ${spec.stage}.`);
    const docs = serviceDocs
      .filter((d) => d.service_id === service.id)
      .sort((a, b) => a.position - b.position);
    const orderId = demoId(`order:${spec.key}`);
    const userId = userIds[spec.user];
    const joint = spec.service === "couple";
    const applicants = joint ? 2 : 1;
    const createdAt = daysAgo(spec.createdDaysAgo);
    const paidAt = spec.paidDaysAgo === undefined ? null : daysAgo(spec.paidDaysAgo);
    const submissionId = spec.answers ? demoId(`submission:${spec.key}`) : null;

    // Stage history: placed, paid, then every later move spread up to the end date.
    const path = ownStages.filter((s) => s.position <= target.position);
    const events = [{ from: null, to: path[0].key, at: createdAt, note: "Demo data: order placed" }];
    if (paidAt && path.length > 1) {
      events.push({ from: path[0].key, to: path[1].key, at: paidAt, note: "Demo data: payment received" });
      const later = path.slice(2);
      const start = addHours(paidAt, 24);
      const end = notAfterNow(spec.endDaysAgo === undefined ? daysAgo(0.5) : daysAgo(spec.endDaysAgo));
      later.forEach((stage, i) => {
        const at = new Date(start.getTime() + ((end.getTime() - start.getTime()) * (i + 1)) / later.length);
        events.push({ from: path[i + 1].key, to: stage.key, at, note: "Demo data: stage moved" });
      });
    }
    const lastMove = events[events.length - 1].at;
    const completedAt = target.is_terminal ? lastMove : null;

    rows.user_services.push({
      id: orderId,
      user_id: userId,
      service_id: service.id,
      submission_id: submissionId,
      answers_snapshot: spec.answers ?? {},
      joint,
      applicants,
      total_cents: service.price_cents,
      currency: service.currency || "eur",
      stage_key: spec.stage,
      stripe_checkout_session_id: null,
      stripe_payment_intent_id: null,
      paid_at: paidAt ? iso(paidAt) : null,
      completed_at: completedAt ? iso(completedAt) : null,
      report: spec.report ?? null,
      created_at: iso(createdAt),
    });

    events.forEach((event, i) => {
      rows.user_service_events.push({
        id: demoId(`event:${spec.key}:${i}`),
        user_service_id: orderId,
        from_stage: event.from,
        to_stage: event.to,
        note: event.note,
        actor_id: null,
        created_at: iso(event.at),
      });
    });

    if (spec.answers) {
      for (const [answerKey, value] of Object.entries(spec.answers)) {
        const questionKey = QUESTION_KEY_BY_ANSWER[answerKey];
        if (!questionKey) continue;
        rows.user_answers.push({
          id: demoId(`answer:${spec.key}:${questionKey}`),
          user_id: userId,
          submission_id: submissionId,
          question_key: questionKey,
          answer: value,
          created_at: iso(createdAt),
        });
      }
    }

    const people = spec.people ?? [];
    people.forEach((person, index) => {
      rows.user_service_applicants.push({
        id: demoId(`applicant:${spec.key}:${index}`),
        user_service_id: orderId,
        applicant_index: index,
        ...PEOPLE[person],
        created_at: iso(addHours(paidAt ?? createdAt, 1)),
      });
    });

    // Documents, one row per filled slot.
    let docCount = 0;
    if (paidAt) {
      for (const doc of docs) {
        const slots = doc.per_applicant ? applicants : 1;
        const plan = spec.docs === "all-approved" ? Array(slots).fill("approved") : spec.docs?.[doc.key] ?? [];
        for (let index = 0; index < slots; index += 1) {
          const entry = plan[index];
          if (!entry) continue;
          const status = typeof entry === "string" ? entry : entry.status;
          const rowId = demoId(`document:${spec.key}:${doc.key}:${index}`);
          const uploadedAt = notAfterNow(addHours(paidAt, 3 + docCount * 0.25));
          const reviewedAt =
            status === "approved" || status === "rejected" ? notAfterNow(addHours(uploadedAt, 6)) : null;
          const personName = PEOPLE[people[index]]?.full_name ?? (index === 0 ? "First applicant" : "Second applicant");
          const key = `orders/${orderId}/demo/${doc.key}/${index}/${rowId}.pdf`;
          const body = await placeholderPdf(doc.label, [
            `Order ${orderId}`,
            `Applicant: ${personName}`,
            `Slot: ${doc.key}, applicant ${index}`,
          ]);
          files.push({ key, body });
          rows.user_documents.push({
            id: rowId,
            user_service_id: orderId,
            service_doc_id: doc.id,
            applicant_index: index,
            storage_key: key,
            file_name: `${doc.key.replace(/_/g, "-")}-demo.pdf`,
            mime_type: "application/pdf",
            size_bytes: body.byteLength,
            status,
            rejection_reason: status === "rejected" ? entry.reason : null,
            uploaded_at: iso(uploadedAt),
            reviewed_at: reviewedAt ? iso(reviewedAt) : null,
            reviewed_by: null,
            created_at: iso(new Date(uploadedAt.getTime() - 60 * 1000)),
          });
          docCount += 1;
        }
      }
    }

    // Deliverables the firm returned: ready when the bucket is there, pending otherwise.
    for (const templateKey of spec.deliverables ?? []) {
      const template =
        templates.find((t) => t.service_id === service.id && t.key === templateKey) ??
        fail(`${spec.service} has no deliverable ${templateKey}.`);
      const rowId = demoId(`deliverable:${spec.key}:${templateKey}`);
      const key = `deliverables/${orderId}/demo/${rowId}.pdf`;
      const body = await placeholderPdf(template.label, [`Order ${orderId}`, `Deliverable: ${templateKey}`]);
      if (r2) files.push({ key, body });
      rows.user_service_deliverables.push({
        id: rowId,
        user_service_id: orderId,
        service_deliverable_id: template.id,
        label: template.label,
        storage_key: r2 ? key : null,
        status: r2 ? "ready" : "pending",
        file_name: r2 ? `${templateKey.replace(/_/g, "-")}-demo.pdf` : null,
        mime_type: r2 ? "application/pdf" : null,
        size_bytes: r2 ? body.byteLength : null,
        uploaded_by: null,
        created_at: iso(notAfterNow(addHours(lastMove, -2))),
      });
    }

    // The service agreement, as the platform would have prepared it after payment.
    let agreement = "";
    if (spec.contract && paidAt && service.contract_template && people.length > 0) {
      const template = service.contract_template;
      const applicant = rows.user_service_applicants.find((a) => a.user_service_id === orderId && a.applicant_index === 0);
      const user = USERS.find((u) => u.key === spec.user);
      const generatedAt = addHours(paidAt, 0.5);
      let body;
      let variables;
      let fileName;
      if (contracts) {
        variables = contracts.values({
          template,
          applicant,
          email: user.email,
          totalCents: service.price_cents,
          paidAt: iso(paidAt),
          signingPlace: null,
        });
        body = new Uint8Array(await contracts.generate(template, variables, { reference: orderId }));
        fileName = contracts.fileName(template, applicant.full_name);
        agreement = "agreement";
      } else {
        variables = {};
        body = await placeholderPdf("Service agreement", [`Order ${orderId}`, `Template: ${template}`]);
        fileName = `service-agreement-${template}-demo.pdf`;
        agreement = "agreement (placeholder)";
      }
      const key = `contracts/${orderId}/demo/v1.pdf`;
      files.push({ key, body });
      rows.user_service_contracts.push({
        id: demoId(`contract:${spec.key}`),
        user_service_id: orderId,
        template,
        version: 1,
        storage_key: key,
        file_name: fileName,
        size_bytes: body.byteLength,
        variables,
        generated_at: iso(generatedAt),
        // Stamped, so the agreement reads as sent. The guard against emailing a
        // demo address lives in sendEmail, which skips every .invalid recipient.
        emailed_at: iso(generatedAt),
        created_at: iso(generatedAt),
      });
    }

    const deliverableCount = (spec.deliverables ?? []).length;
    orderLines.push(
      `  ${spec.key.padEnd(24)} ${spec.service.padEnd(10)} ${spec.stage.padEnd(26)} ` +
        [
          paidAt ? "paid" : "unpaid",
          completedAt ? "completed" : "",
          docCount ? `${docCount} document${docCount === 1 ? "" : "s"}` : "",
          deliverableCount ? `${deliverableCount} deliverable${deliverableCount === 1 ? "" : "s"}` : "",
          people.length ? `details x${people.length}` : "",
          agreement,
        ]
          .filter(Boolean)
          .join(", "),
    );
  }

  // --- Files first, so no row ever points at a file that is not there ------
  let uploaded = 0;
  if (r2) {
    for (const file of files) {
      if (!file.key.includes("/demo/")) fail(`Refusing to write ${file.key}: demo keys must contain /demo/.`);
      await r2.client.send(
        new PutObjectCommand({
          Bucket: r2.bucket,
          Key: file.key,
          Body: file.body,
          ContentType: "application/pdf",
          ContentLength: file.body.byteLength,
        }),
      );
      uploaded += 1;
    }
  } else {
    console.warn("\n  ! S3_* variables missing: no file uploaded, deliverables left pending.");
  }

  // --- Then the rows, parents before children ------------------------------
  const conflictKeys = {
    user_service_applicants: "user_service_id,applicant_index",
    user_service_contracts: "user_service_id",
  };
  for (const [table, list] of Object.entries(rows)) {
    if (list.length === 0) continue;
    await check(table, supabase.from(table).upsert(list, { onConflict: conflictKeys[table] ?? "id" }));
  }

  console.log("\nOrders");
  console.log(orderLines.join("\n"));
  console.log("\nRows written (inserted or reset)");
  for (const [table, list] of Object.entries(rows)) console.log(`  ${table.padEnd(26)} ${list.length}`);
  console.log(`\nFiles in the bucket (keys under /demo/): ${uploaded}`);
  console.log(`\nEvery account is on ${DEMO_DOMAIN}. Remove it all with: npm run db:purge -- --demo --apply\n`);
}

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exit(1);
});
