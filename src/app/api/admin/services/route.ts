import { listServicesForAdmin } from "@/lib/db/admin-queries";
import { upsertService, validateServiceInput } from "@/lib/orders/services-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/admin-user";

import { INVALID_BODY, audit, errorResponse, readJson, refuse } from "../_lib/http";

/**
 * GET /api/admin/services: every service, inactive ones included, with
 * stages, documents and deliverables nested. Answers `{ services }`.
 *
 * POST /api/admin/services: creates one from the editor's form (see
 * validateServiceInput for the shape). 422 names the first field wrong;
 * 409 a slug already in use. Answers 201 `{ service }`.
 *
 * Contract section 6.
 */
export async function GET() {
  try {
    await requireAdmin();
    const services = await listServicesForAdmin(createAdminClient());
    return Response.json({ services });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();

    const body = await readJson(request);
    if (!body) return refuse(400, INVALID_BODY);
    const result = validateServiceInput(body);
    if (!result.ok) return refuse(422, result.error);

    const service = await upsertService(createAdminClient(), result.value);
    audit(admin, "service.create", service.id, service.slug);
    return Response.json({ service }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
