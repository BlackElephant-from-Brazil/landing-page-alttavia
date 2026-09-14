import { NextResponse } from "next/server";

import { signingDateFor } from "@/content/power-of-attorney";
import type { ServiceDocRow, UserRole } from "@/lib/db/types";
import { findApplicant, findOrder, poaFileName, toPrincipal } from "@/lib/orders/applicants";
import { generatePowerOfAttorney } from "@/lib/poa/generate";
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
 * service and carry a template, so a passport slot never yields a deed.
 * Then, in order: the applicant index is below the order's `applicants`,
 * the order is paid (409 "Payment first."), and the details exist
 * (409 `details_missing`, the code the slot reacts to by opening the form).
 *
 * An order that does not exist, or is not the caller's, answers 403 "This
 * order is not yours." the way the documents routes do, so a client cannot
 * tell the two apart; only an admin gets 404 for a missing order. The deed
 * slot is looked at after that, so a stranger learns nothing about it.
 *
 * A visitor without a session is sent to login rather than given a JSON
 * 401, because this URL is opened by a click. `ctx.params` is a Promise in
 * this Next.js.
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

type Params = { params: Promise<{ id: string; docId: string }> };

function refuse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
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

export async function GET(request: Request, ctx: Params) {
  try {
    const user = await getUserWithRole();
    if (!user) return NextResponse.redirect(new URL(LOGIN, request.url), 302);

    const { id, docId } = await ctx.params;
    if (!UUID.test(id)) return missingOrder(user);

    const admin = createAdminClient();
    const order = await findOrder(admin, id);
    if (!order) return missingOrder(user);

    const owner = order.user_id === user.id;
    if (!owner && user.role !== "admin") return refuse(403, NOT_YOURS);

    if (!UUID.test(docId)) return refuse(404, DEED_NOT_FOUND);
    const applicantIndex = parseIndex(new URL(request.url).searchParams.get("applicant") ?? "0");
    if (applicantIndex === null) return refuse(422, NO_APPLICANT);

    const { data: docData, error: docError } = await admin.from("service_docs").select("*").eq("id", docId).maybeSingle();
    if (docError) throw new Error(`service_docs: ${docError.message}`);
    const doc = docData as ServiceDocRow | null;
    if (!doc || doc.service_id !== order.service_id || !doc.template) return refuse(404, DEED_NOT_FOUND);

    const applicants = doc.per_applicant ? order.applicants : 1;
    if (applicantIndex >= applicants) return refuse(422, NO_APPLICANT);

    if (!order.paid_at) return refuse(409, PAYMENT_FIRST);

    const applicant = await findApplicant(admin, order.id, applicantIndex);
    if (!applicant) return refuse(409, DETAILS_MISSING);

    const pdf = await generatePowerOfAttorney(doc.template, toPrincipal(applicant), signingDateFor(new Date()));
    if (!owner) console.info(`[admin] ${user.id} poa.download ${order.id} ${doc.key} applicant ${applicantIndex}`);

    // A fresh copy of the bytes: pdf-lib hands back a view over a buffer it may reuse.
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.byteLength),
        "Content-Disposition": `attachment; filename="${poaFileName(doc.template, applicant.full_name)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[orders/[id]/poa/[docId]]", error);
    return refuse(500, GENERIC);
  }
}
