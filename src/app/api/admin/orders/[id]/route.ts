import type { UserServiceRow } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/admin-user";

import { INVALID_BODY, audit, errorResponse, isUuid, readJson, refuse } from "../../_lib/http";

/**
 * PATCH /api/admin/orders/[id], body `{ report }`. Contract section 6.
 *
 * The final report, markdown allowed, at most 20000 characters. An empty
 * string or null clears it. Answers `{ order }` with the row after the
 * write.
 */

const MAX_REPORT_LENGTH = 20000;

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();

    const { id } = await ctx.params;
    if (!isUuid(id)) return refuse(404, "Order not found.");

    const body = await readJson(request);
    if (!body || !("report" in body)) return refuse(400, INVALID_BODY);

    let report: string | null;
    if (body.report === null) {
      report = null;
    } else if (typeof body.report === "string") {
      report = body.report.trim() || null;
      if (report && report.length > MAX_REPORT_LENGTH) {
        return refuse(422, `Keep the report under ${MAX_REPORT_LENGTH} characters.`);
      }
    } else {
      return refuse(400, INVALID_BODY);
    }

    const db = createAdminClient();
    const { data, error } = await db.from("user_services").update({ report }).eq("id", id).select("*").maybeSingle();
    if (error) throw new Error(`user_services: ${error.message}`);
    if (!data) return refuse(404, "Order not found.");

    audit(admin, "order.report", id, report ? `${report.length} chars` : "cleared");
    return Response.json({ order: data as UserServiceRow });
  } catch (error) {
    return errorResponse(error);
  }
}
