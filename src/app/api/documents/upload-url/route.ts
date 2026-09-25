import { NextResponse } from "next/server";

import { getOrderContract, getUserService } from "@/lib/db/queries";
import type { ServiceDocRow, UserDocumentRow } from "@/lib/db/types";
import { APPROVED_LOCKED, DOCUMENTS_STAGE, REVIEW_LOCKED, STAGE_CLOSED, isOrderFile } from "@/lib/documents/confirm";
import { isAgreementTemplate } from "@/lib/documents/templates";
import { deleteObject, presignUpload } from "@/lib/r2/client";
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
 * to for five minutes. Step two is /api/documents/confirm, or
 * /api/documents/upload when that PUT does not arrive.
 *
 * Nothing from the body is trusted: the order has to be the caller's and
 * paid, the document has to belong to the order's service, the applicant has
 * to exist, and type and size have to fit what `service_docs` allows. Every
 * refusal is one short line the slot shows as it is.
 *
 * What a slot accepts (changed 2026-09-22):
 *
 *   - Nothing at all unless the order sits on the documents stage. That is
 *     the one stage on which a client sends files, and the same rule the
 *     Remove button answers to, so a slot is opened and closed at the same
 *     moment. Before this an empty or rejected slot stayed open on every
 *     stage, a completed order included.
 *   - `pending`: an upload that never finished. The new attempt takes the
 *     row over, whatever its age. Before this, a pending row held its slot
 *     for fifteen minutes and a client whose upload failed was told "This
 *     slot already has a file." and could do nothing.
 *   - `rejected`: the slot is open, as it always was.
 *   - `uploaded`: open, so a client may replace a file that is still waiting
 *     for review. The file it replaces is dropped after the new one is
 *     confirmed, never before.
 *   - `approved`: closed.
 *
 * The signed agreement slot (`template` 'agreement', 0013) also stays closed
 * while the order has no service agreement yet (2026-09-25): there is
 * nothing to sign before the client confirms their details, and every file
 * confirmed in that slot is mailed to the firm as the signed copy. The slot
 * in the dashboard hides its input until then; this is the same rule on the
 * server, so a request made by hand meets it too.
 *
 * Why a repeat attempt reuses the pending row rather than starting a new one
 * (2026-09-22). `buildStorageKey` ends in a fresh uuid, so a new row means a
 * new object. Deleting the old row and inserting a new one on every call let
 * one client hold any number of presigned URLs, PUT a full sized file to each
 * of them and leave every object but the last with no row pointing at it:
 * storage nobody can see and nobody can remove. The row is now updated in
 * place, conditionally, so a slot holds at most one unfinished upload. Only a
 * change of file type moves the key, and the object it leaves goes with it.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The unfinished upload this attempt meant to take over was finished or removed meanwhile. */
const SLOT_CHANGED = "This slot changed a moment ago. Refresh the page and try again.";

/** The signed agreement slot, before the order has an agreement to sign. */
const AGREEMENT_FIRST = "Your agreement is not ready yet. Confirm your details first.";

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

    if (isAgreementTemplate(doc.template) && !(await getOrderContract(admin, order.id))) {
      return refuse(409, AGREEMENT_FIRST);
    }

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

    const closed = slotClosed(latest, order.stage_key);
    if (closed) return refuse(409, closed);

    const file = {
      file_name: sanitizeFileName(body.fileName),
      mime_type: body.mimeType,
      size_bytes: body.sizeBytes,
    };

    // An upload that never finished keeps its row and, when the file type has
    // not changed, its key: one slot, one object.
    if (latest && latest.status === "pending") {
      const sameType = latest.storage_key.endsWith(`.${ext}`);
      const key = sameType ? latest.storage_key : buildStorageKey(order.id, doc.key, body.applicantIndex, ext);

      const { data: taken, error: takeError } = await admin
        .from("user_documents")
        .update({ ...file, storage_key: key })
        .eq("id", latest.id)
        .eq("status", "pending")
        .eq("storage_key", latest.storage_key)
        .select("id");
      if (takeError) throw new Error(`user_documents update: ${takeError.message}`);
      if (((taken ?? []) as unknown[]).length === 0) return refuse(409, SLOT_CHANGED);

      if (!sameType) await dropObject(latest);

      const { url, expiresIn } = await presignUpload({
        key,
        contentType: body.mimeType,
        contentLength: body.sizeBytes,
      });
      return NextResponse.json({ documentId: latest.id, url, key, expiresIn });
    }

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
        ...file,
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

/** The line to refuse a new file with, or null when the slot takes one. */
function slotClosed(latest: UserDocumentRow | null, stageKey: string): string | null {
  if (latest?.status === "approved") return APPROVED_LOCKED;
  if (stageKey !== DOCUMENTS_STAGE) return latest ? REVIEW_LOCKED : STAGE_CLOSED;
  return null;
}

/**
 * Removes the object of an attempt whose key has just been replaced, in case
 * a late PUT did land on it. Best effort: the row now points elsewhere, so
 * what is left behind is an object nothing references, worth a log line and
 * no more.
 */
async function dropObject(latest: UserDocumentRow): Promise<void> {
  try {
    if (isOrderFile(latest)) await deleteObject(latest.storage_key);
  } catch (error) {
    console.error("[documents/upload-url] stale object not removed", error);
  }
}
