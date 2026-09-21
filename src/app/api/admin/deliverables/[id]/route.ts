import { NextResponse } from "next/server";

import type { UserServiceDeliverableRow } from "@/lib/db/types";
import { deleteDeliverable } from "@/lib/orders/deliverables";
import { presignDownload } from "@/lib/r2/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/admin-user";

import { audit, errorResponse, isUuid, refuse } from "../../_lib/http";

/**
 * GET /api/admin/deliverables/[id]: a presigned download of a returned
 * file, any status but pending, good for two minutes, as a 302. Contract
 * sections 6 and 9. One log line per download.
 *
 * DELETE /api/admin/deliverables/[id]: takes back a file sent by mistake.
 * deleteDeliverable removes the object in the bucket, then the row, so the
 * client stops seeing it on their next load. Answers `{ deleted: true }`;
 * 404 "This file is not on record." for an id with no row. One log line.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();

    const { id } = await ctx.params;
    if (!isUuid(id)) return refuse(404, "This file is not on record.");

    const db = createAdminClient();
    const { data, error } = await db.from("user_service_deliverables").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`user_service_deliverables: ${error.message}`);
    const row = data as UserServiceDeliverableRow | null;
    if (!row) return refuse(404, "This file is not on record.");
    if (row.status !== "ready" || !row.storage_key) return refuse(404, "This file has not arrived yet.");

    const { url } = await presignDownload({
      key: row.storage_key,
      fileName: row.file_name ?? undefined,
      contentType: row.mime_type ?? undefined,
    });
    audit(admin, "deliverable.download", id);

    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();

    const { id } = await ctx.params;
    if (!isUuid(id)) return refuse(404, "This file is not on record.");

    const row = await deleteDeliverable(id);
    audit(admin, "deliverable.delete", id, `order ${row.user_service_id}`);

    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
