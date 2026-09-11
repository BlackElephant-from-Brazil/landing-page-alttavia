import { MAX_REASON_LENGTH, reviewDocument, type ReviewDecision } from "@/lib/orders/review";
import { requireAdmin } from "@/lib/supabase/admin-user";

import { INVALID_BODY, audit, errorResponse, isUuid, readJson, refuse, requestOrigin } from "../../../_lib/http";

/**
 * POST /api/admin/documents/[id]/review, body `{ decision, reason? }`.
 * Contract section 6.
 *
 * Answers `{ document, emailed }`: the row after the review and whether the
 * rejection email went out. A reject without a reason is 422; a document
 * that is not waiting for review is 409.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();

    const { id } = await ctx.params;
    if (!isUuid(id)) return refuse(404, "This file is not on record.");

    const body = await readJson(request);
    if (!body) return refuse(400, INVALID_BODY);

    const decision = body.decision;
    if (decision !== "approve" && decision !== "reject") return refuse(400, INVALID_BODY);

    let reason: string | null = null;
    if (body.reason !== undefined && body.reason !== null) {
      if (typeof body.reason !== "string") return refuse(400, INVALID_BODY);
      reason = body.reason.trim();
      if (reason.length > MAX_REASON_LENGTH) {
        return refuse(422, `Keep the reason under ${MAX_REASON_LENGTH} characters.`);
      }
    }
    if (decision === "reject" && !reason) return refuse(422, "Give the client a reason.");

    const result = await reviewDocument(id, decision as ReviewDecision, reason, admin.id, requestOrigin(request));
    audit(admin, `document.${decision}`, id, result.emailed ? "emailed" : undefined);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
