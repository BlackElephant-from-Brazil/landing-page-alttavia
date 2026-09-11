import { NextResponse } from "next/server";

import { getUserService } from "@/lib/db/queries";
import type { ServiceDocRow, UserDocumentRow } from "@/lib/db/types";
import { presignUpload } from "@/lib/r2/client";
import {
  acceptedTypesMessage,
  buildStorageKey,
  extensionFor,
  sanitizeFileName,
  sizeLimitMessage,
} from "@/lib/r2/keys";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/user";

/**
 * POST /api/documents/upload-url
 *
 * Step one of an upload. The browser says which slot it wants to fill and
 * what file it holds; this handler checks every claim against the database,
 * writes a `pending` row and hands back a URL the browser can PUT the file
 * to for five minutes. Step two is /api/documents/confirm.
 *
 * Nothing from the body is trusted: the order has to be the caller's and
 * paid, the document has to belong to the order's service, the applicant has
 * to exist, and type and size have to fit what `service_docs` allows. Every
 * refusal is one short line the slot shows as it is.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A `pending` row older than this is an upload that never finished (the
 * presigned URL lasted five minutes) and no longer blocks its slot, so a
 * closed tab does not lock a document forever.
 */
const PENDING_GRACE_MS = 15 * 60 * 1000;

type Body = {
  userServiceId: string;
  serviceDocId: string;
  applicantIndex: 0 | 1;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

function parseBody(raw: unknown): Body | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const userServiceId = typeof b.userServiceId === "string" ? b.userServiceId.trim() : "";
  const serviceDocId = typeof b.serviceDocId === "string" ? b.serviceDocId.trim() : "";
  const applicantIndex = b.applicantIndex;
  const fileName = typeof b.fileName === "string" ? b.fileName.trim() : "";
  const mimeType = typeof b.mimeType === "string" ? b.mimeType.trim().toLowerCase() : "";
  const sizeBytes = b.sizeBytes;
  if (!UUID.test(userServiceId) || !UUID.test(serviceDocId)) return null;
  if (applicantIndex !== 0 && applicantIndex !== 1) return null;
  if (!fileName || !mimeType) return null;
  if (typeof sizeBytes !== "number" || !Number.isInteger(sizeBytes) || sizeBytes <= 0) return null;
  return { userServiceId, serviceDocId, applicantIndex, fileName, mimeType, sizeBytes };
}

function refuse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return refuse(401, "Sign in to continue.");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return refuse(400, "Check the file details and try again.");
  }
  const body = parseBody(raw);
  if (!body) return refuse(400, "Check the file details and try again.");

  try {
    const admin = createAdminClient();

    const order = await getUserService(admin, body.userServiceId, user.id);
    if (!order) return refuse(403, "This order is not yours.");
    if (!order.paid_at) return refuse(409, "Payment first.");

    const { data: docData, error: docError } = await admin
      .from("service_docs")
      .select("*")
      .eq("id", body.serviceDocId)
      .maybeSingle();
    if (docError) throw new Error(`service_docs: ${docError.message}`);
    const doc = docData as ServiceDocRow | null;
    if (!doc || doc.service_id !== order.service_id) {
      return refuse(422, "This document does not belong to your service.");
    }

    const applicants = doc.per_applicant ? order.applicants : 1;
    if (body.applicantIndex >= applicants) return refuse(422, "There is no applicant at that position.");

    const ext = extensionFor(body.mimeType);
    if (!ext || !doc.accepted_mime.includes(body.mimeType)) {
      return refuse(415, acceptedTypesMessage(doc.accepted_mime));
    }
    if (body.sizeBytes > doc.max_bytes) return refuse(413, sizeLimitMessage(doc.max_bytes));

    const { data: latestData, error: latestError } = await admin
      .from("user_documents")
      .select("*")
      .eq("user_service_id", order.id)
      .eq("service_doc_id", doc.id)
      .eq("applicant_index", body.applicantIndex)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw new Error(`user_documents: ${latestError.message}`);
    const latest = latestData as UserDocumentRow | null;
    if (latest && slotIsTaken(latest)) return refuse(409, "This slot already has a file.");

    const key = buildStorageKey(order.id, doc.key, body.applicantIndex, ext);
    const { url, expiresIn } = await presignUpload({
      key,
      contentType: body.mimeType,
      contentLength: body.sizeBytes,
    });

    const { data: inserted, error: insertError } = await admin
      .from("user_documents")
      .insert({
        user_service_id: order.id,
        service_doc_id: doc.id,
        applicant_index: body.applicantIndex,
        storage_key: key,
        file_name: sanitizeFileName(body.fileName),
        mime_type: body.mimeType,
        size_bytes: body.sizeBytes,
        status: "pending",
      })
      .select("id")
      .single();
    if (insertError || !inserted) {
      throw new Error(`user_documents insert: ${insertError?.message ?? "no row"}`);
    }

    return NextResponse.json({ documentId: inserted.id as string, url, key, expiresIn });
  } catch (error) {
    console.error("[documents/upload-url]", error);
    return refuse(500, "Something did not work. Try again.");
  }
}

/** Uploaded and approved files hold their slot; rejected ones give it up; a pending one holds it while its URL could still be used. */
function slotIsTaken(latest: UserDocumentRow): boolean {
  if (latest.status === "rejected") return false;
  if (latest.status === "pending") {
    const age = Date.now() - new Date(latest.created_at).getTime();
    return age < PENDING_GRACE_MS;
  }
  return true;
}
