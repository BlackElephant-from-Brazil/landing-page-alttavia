import { NextResponse } from "next/server";

import { DocumentError, confirmDocumentUpload, loadOwnDocument, loadServiceDoc } from "@/lib/documents/confirm";
import { checkDirectUpload, contentLengthOf, requireDeclaredLength } from "@/lib/documents/direct-upload";
import { putObject } from "@/lib/r2/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/user";

/**
 * POST /api/documents/upload?documentId=<id>
 *
 * The same origin fallback. The browser asks for an upload URL as usual, and
 * when its PUT straight to the bucket does not arrive it posts the very bytes
 * it already read to this route instead, raw, with the row's own type as
 * Content-Type. We write them to the bucket and finish the upload exactly as
 * /api/documents/confirm does, through the shared module.
 *
 * Why it exists: on 2026-09-22 a client's proof of address never reached the
 * bucket although a passport from the same browser had seconds earlier. The
 * request itself was lost, so the way out is a request to our own origin,
 * which is already carrying the session.
 *
 * Checks, in order: the session, that the order is the caller's, that the row
 * is still `pending`, that the declared type and length match the row, that
 * the row fits what a request may carry (about 4.5 MB, because a Netlify
 * function takes around 6 MB of payload), that the request declares a length
 * at all (411 otherwise, so no body is read before it can be measured), and
 * finally that the bytes read are the bytes promised. Nothing about the
 * object comes from the request: the key, the type and the size are the row's.
 *
 * Answers `{ document }`, the finished row, the same shape as /confirm.
 * A row already `uploaded` answers 200 with the row and writes nothing.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refuse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** The origin links inside the team email are built on. */
function requestOrigin(request: Request): string | null {
  const given = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get("origin");
  if (given) return given;
  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return refuse(401, "Sign in to continue.");

  let documentId = "";
  try {
    documentId = (new URL(request.url).searchParams.get("documentId") ?? "").trim();
  } catch {
    // handled below
  }
  if (!UUID.test(documentId)) return refuse(400, "Check the file details and try again.");

  try {
    const admin = createAdminClient();
    const { document, order } = await loadOwnDocument(admin, documentId, user.id);

    // Already finished: the earlier request did arrive after all.
    if (document.status === "uploaded") return NextResponse.json({ document });
    if (document.status !== "pending") return refuse(409, "This file has already been reviewed.");
    if (!order.paid_at) return refuse(409, "Payment first.");

    const doc = await loadServiceDoc(admin, document.service_doc_id);
    if (!doc) return refuse(422, "This document does not belong to your service.");

    const limits = {
      expectedBytes: document.size_bytes,
      expectedType: document.mime_type,
      maxBytes: doc.max_bytes,
    };

    const headers = checkDirectUpload({
      ...limits,
      contentType: request.headers.get("content-type"),
      contentLength: contentLengthOf(request),
    });
    if (!headers.ok) return refuse(headers.status, headers.error);

    // Nothing is read until the request says how long it is: without that,
    // the body would be pulled into memory whole before anyone could measure
    // it. The ownership and status checks are already done, so a caller who
    // has no business here never reaches this line.
    const declared = requireDeclaredLength(contentLengthOf(request));
    if (!declared.ok) return refuse(declared.status, declared.error);

    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await request.arrayBuffer());
    } catch (error) {
      console.error("[documents/upload] body not read", error);
      return refuse(422, "This file did not arrive whole. Try again.");
    }

    const body = checkDirectUpload({ ...limits, receivedBytes: bytes.byteLength });
    if (!body.ok) return refuse(body.status, body.error);

    await putObject({ key: document.storage_key, body: bytes, contentType: document.mime_type });

    const confirmed = await confirmDocumentUpload({
      db: admin,
      document,
      order,
      origin: requestOrigin(request),
    });

    return NextResponse.json({ document: confirmed });
  } catch (error) {
    if (error instanceof DocumentError) return refuse(error.status, error.message);
    console.error("[documents/upload]", error);
    return refuse(500, "Something did not work. Try again.");
  }
}
