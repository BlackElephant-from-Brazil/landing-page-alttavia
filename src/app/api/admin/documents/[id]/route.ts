import { NextResponse } from "next/server";

import type { UserDocumentRow } from "@/lib/db/types";
import { presignDownload } from "@/lib/r2/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/admin-user";

import { audit, errorResponse, isUuid, refuse } from "../../_lib/http";

/**
 * GET /api/admin/documents/[id]: a presigned download of any client's
 * document, good for two minutes, answered as a 302 so a plain link in the
 * order modal works. Contract sections 6 and 9.
 *
 * A pending row has no confirmed object behind it yet and answers 404 like
 * an unknown id. Every download is one line in the server log.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();

    const { id } = await ctx.params;
    if (!isUuid(id)) return refuse(404, "This file is not on record.");

    const db = createAdminClient();
    const { data, error } = await db.from("user_documents").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`user_documents: ${error.message}`);
    const doc = data as UserDocumentRow | null;
    if (!doc) return refuse(404, "This file is not on record.");
    if (doc.status === "pending") return refuse(404, "This file has not arrived yet.");

    const { url } = await presignDownload({ key: doc.storage_key, fileName: doc.file_name, contentType: doc.mime_type });
    audit(admin, "document.download", id);

    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
