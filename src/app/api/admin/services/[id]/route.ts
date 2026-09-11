import { getServiceForAdmin } from "@/lib/db/admin-queries";
import { upsertService, validateServiceInput } from "@/lib/orders/services-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/admin-user";

import { INVALID_BODY, audit, errorResponse, isUuid, readJson, refuse } from "../../_lib/http";

/**
 * GET /api/admin/services/[id]: one service with its configuration, active
 * or not. Answers `{ service }` or 404.
 *
 * PATCH /api/admin/services/[id]: the whole editor form again (same shape as
 * POST). Stages, documents and deliverables are matched by key: present
 * ones are updated or added, missing ones deleted, and a stage an order
 * still sits on answers 409 with the count. Answers `{ service }`.
 *
 * Contract section 6.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();

    const { id } = await ctx.params;
    if (!isUuid(id)) return refuse(404, "Service not found.");

    const service = await getServiceForAdmin(createAdminClient(), id);
    if (!service) return refuse(404, "Service not found.");
    return Response.json({ service });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();

    const { id } = await ctx.params;
    if (!isUuid(id)) return refuse(404, "Service not found.");

    const body = await readJson(request);
    if (!body) return refuse(400, INVALID_BODY);
    const result = validateServiceInput(body);
    if (!result.ok) return refuse(422, result.error);

    const service = await upsertService(createAdminClient(), result.value, id);
    audit(admin, "service.update", id, service.slug);
    return Response.json({ service });
  } catch (error) {
    return errorResponse(error);
  }
}
