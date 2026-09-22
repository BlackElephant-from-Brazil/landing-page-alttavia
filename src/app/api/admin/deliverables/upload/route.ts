import { openDeliverableUpload, receiveDeliverableBytes } from "@/lib/deliverables/receive";
import { contentLengthOf, requireDeclaredLength } from "@/lib/documents/direct-upload";
import { requireAdmin } from "@/lib/supabase/admin-user";

import { INVALID_BODY, audit, errorResponse, isUuid, refuse } from "../../_lib/http";

/**
 * POST /api/admin/deliverables/upload?deliverableId=<id>, raw body, the
 * row's own type as Content-Type.
 *
 * The same origin fallback for a file the firm returns, the twin of
 * POST /api/documents/upload on the client's side. The browser asks for an
 * upload URL as usual and posts the bytes here when its PUT to the bucket
 * does not arrive, which is what happened to a 526 KB image on 2026-09-22.
 *
 * The checks and the write live in src/lib/deliverables/receive.ts; the row
 * is finished by `confirmDeliverable`, the same function the ordinary confirm
 * route calls. Answers `{ deliverable }`. A row already `ready` answers 200
 * with the row and writes nothing.
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();

    const deliverableId = (new URL(request.url).searchParams.get("deliverableId") ?? "").trim();
    if (!isUuid(deliverableId)) return refuse(400, INVALID_BODY);

    const { row, done } = await openDeliverableUpload({
      deliverableId,
      contentType: request.headers.get("content-type"),
      contentLength: contentLengthOf(request),
    });
    if (done) return Response.json({ deliverable: row });

    // Same guard as the client's fallback: a request that does not say how
    // long its body is would be read whole before it could be measured.
    const declared = requireDeclaredLength(contentLengthOf(request));
    if (!declared.ok) return refuse(declared.status, declared.error);

    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await request.arrayBuffer());
    } catch (error) {
      console.error("[admin/deliverables/upload] body not read", error);
      return refuse(422, "This file did not arrive whole. Try again.");
    }

    const deliverable = await receiveDeliverableBytes(row, bytes);
    audit(admin, "deliverable.upload", deliverableId, `order ${row.user_service_id} through the server`);

    return Response.json({ deliverable });
  } catch (error) {
    return errorResponse(error);
  }
}
