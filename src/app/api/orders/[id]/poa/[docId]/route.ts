import { NextResponse } from "next/server";

import { signingDateFor } from "@/content/power-of-attorney";
import type { ServiceDocRow, UserRole } from "@/lib/db/types";
import { isDeedTemplate } from "@/lib/documents/templates";
import { findApplicant, findOrder, poaFileName, toPrincipal } from "@/lib/orders/applicants";
import { generatePowerOfAttorney } from "@/lib/poa/generate";
import { JOINT_DEED_APPLICANTS, isJointDeed } from "@/lib/poa/joint";
import { siteOrigin } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserWithRole } from "@/lib/supabase/admin-user";

/**
 * GET /api/orders/[id]/poa/[docId]?applicant=0|1. Contract
 * (docs/documents-contract.md) section 3, "Server".
 *
 * The power of attorney for one applicant of one order, filled with the
 * details they entered and dated today in Lisbon, as a PDF download. The
 * client downloads it to sign; the admin downloads it from the order modal.
 * The client downloads again for a fresh date: nothing is stored.
 *
 * `docId` names the service_docs slot; it has to belong to the order's
 * service and carry a deed template (`poa_nif` or `poa_bank`), so neither a
 * passport slot nor 0013's signed agreement slot ever yields a deed.
 * Then, in order: the applicant index is below the order's `applicants`
 * (422), the order is paid (409 "Payment first."), and the details exist
 * (409 `{ error: "details_missing", applicant }`, the code the slot reacts to
 * by opening the form for that applicant).
 *
 * The couple's joint bank deed (2026-09-25, migration 0016; the rule is
 * isJointDeed in src/lib/poa/joint.ts: template `poa_bank` on a slot that is
 * not per applicant, on a two applicant order) is ONE deed for both persons,
 * signed by both. For it `?applicant` is ignored, both applicant rows are
 * required, a missing one answers 409 details_missing naming the first
 * missing (`applicant: 0`, else `1`), and the file reads
 * `power-of-attorney-bank-<first>-and-<second>.pdf`.
 *
 * An order that does not exist, or is not the caller's, answers 403 "This
 * order is not yours." the way the documents routes do, so a client cannot
 * tell the two apart; only an admin gets 404 for a missing order. The deed
 * slot is looked at after that, so a stranger learns nothing about it.
 *
 * A visitor without a session is sent to login rather than given a JSON
 * 401, because this URL is opened by a click; the redirect is built on
 * siteOrigin (src/lib/site-url.ts), never on 0.0.0.0. `ctx.params` is a
 * Promise in this Next.js.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOGIN = "/en/login?next=/en/dashboard";

const NOT_YOURS = "This order is not yours.";
const ORDER_NOT_FOUND = "Order not found.";
const DEED_NOT_FOUND = "This deed is not on record.";
const NO_APPLICANT = "There is no applicant at that position.";
const PAYMENT_FIRST = "Payment first.";
const DETAILS_MISSING = "details_missing";
const GENERIC = "Something did not work. Try again.";

/*
 * The templates this route builds are the two deeds (isDeedTemplate,
 * src/lib/documents/templates.ts). Since 0013 a slot may also carry
 * 'agreement' (the signed service agreement, served by
 * /api/orders/[id]/contract), which must never come out of here as a deed.
 */

type Params = { params: Promise<{ id: string; docId: string }> };

function refuse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** The details of that applicant are not entered yet: the slot opens the form for them. */
function detailsMissing(applicant: 0 | 1) {
  return NextResponse.json({ error: DETAILS_MISSING, applicant }, { status: 409 });
}

function parseIndex(raw: string): 0 | 1 | null {
  if (raw === "0") return 0;
  if (raw === "1") return 1;
  return null;
}

/** No such order: an admin learns that, anyone else hears what a stranger's order answers. */
function missingOrder(user: { role: UserRole }) {
  return user.role === "admin" ? refuse(404, ORDER_NOT_FOUND) : refuse(403, NOT_YOURS);
}

function pdfDownload(pdf: Uint8Array, fileName: string) {
  // A fresh copy of the bytes: pdf-lib hands back a view over a buffer it may reuse.
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.byteLength),
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request, ctx: Params) {
  try {
    const user = await getUserWithRole();
    if (!user) return NextResponse.redirect(new URL(LOGIN, siteOrigin(request)), 302);

    const { id, docId } = await ctx.params;
    if (!UUID.test(id)) return missingOrder(user);

    const admin = createAdminClient();
    const order = await findOrder(admin, id);
    if (!order) return missingOrder(user);

    const owner = order.user_id === user.id;
    if (!owner && user.role !== "admin") return refuse(403, NOT_YOURS);

    if (!UUID.test(docId)) return refuse(404, DEED_NOT_FOUND);

    const { data: docData, error: docError } = await admin.from("service_docs").select("*").eq("id", docId).maybeSingle();
    if (docError) throw new Error(`service_docs: ${docError.message}`);
    const doc = docData as ServiceDocRow | null;
    if (!doc || doc.service_id !== order.service_id || !isDeedTemplate(doc.template)) return refuse(404, DEED_NOT_FOUND);
    const template = doc.template;

    if (isJointDeed(doc, order.applicants)) {
      if (!order.paid_at) return refuse(409, PAYMENT_FIRST);

      const [first, second] = await Promise.all(
        JOINT_DEED_APPLICANTS.map((applicantIndex) => findApplicant(admin, order.id, applicantIndex)),
      );
      if (!first) return detailsMissing(0);
      if (!second) return detailsMissing(1);

      const pdf = await generatePowerOfAttorney(
        "poa_bank",
        [toPrincipal(first), toPrincipal(second)],
        signingDateFor(new Date()),
      );
      if (!owner) console.info(`[admin] ${user.id} poa.download ${order.id} ${doc.key} applicants 0 and 1`);
      return pdfDownload(pdf, poaFileName("poa_bank", first.full_name, second.full_name));
    }

    const applicantIndex = parseIndex(new URL(request.url).searchParams.get("applicant") ?? "0");
    if (applicantIndex === null) return refuse(422, NO_APPLICANT);

    const applicants = doc.per_applicant ? order.applicants : 1;
    if (applicantIndex >= applicants) return refuse(422, NO_APPLICANT);

    if (!order.paid_at) return refuse(409, PAYMENT_FIRST);

    const applicant = await findApplicant(admin, order.id, applicantIndex);
    if (!applicant) return detailsMissing(applicantIndex);

    const pdf = await generatePowerOfAttorney(template, toPrincipal(applicant), signingDateFor(new Date()));
    if (!owner) console.info(`[admin] ${user.id} poa.download ${order.id} ${doc.key} applicant ${applicantIndex}`);
    return pdfDownload(pdf, poaFileName(template, applicant.full_name));
  } catch (error) {
    console.error("[orders/[id]/poa/[docId]]", error);
    return refuse(500, GENERIC);
  }
}
