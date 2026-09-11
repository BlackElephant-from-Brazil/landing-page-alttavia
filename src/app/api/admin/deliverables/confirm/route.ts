import { confirmDeliverable } from "@/lib/orders/deliverables";
import { requireAdmin } from "@/lib/supabase/admin-user";

import { INVALID_BODY, audit, errorResponse, isUuid, readJson, refuse } from "../../_lib/http";

/**
 * POST /api/admin/deliverables/confirm, body `{ deliverableId }`. Contract
 * section 6. Checks the object in the bucket and flips the row to `ready`,
 * which is when the client can see it. Answers `{ deliverable }`.
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();

    const body = await readJson(request);
    const id = body?.deliverableId;
    if (!isUuid(id)) return refuse(400, INVALID_BODY);

    const deliverable = await confirmDeliverable(id);
    audit(admin, "deliverable.confirm", id, deliverable.status);
    return Response.json({ deliverable });
  } catch (error) {
    return errorResponse(error);
  }
}
