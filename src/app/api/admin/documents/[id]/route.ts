import { NextResponse } from "next/server";

import type { UserDocumentRow } from "@/lib/db/types";
import { presignDownload } from "@/lib/r2/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/admin-user";

import { audit, errorResponse, isUuid, refuse } from "../../_lib/http";

/**
 * GET /api/admin/documents/[id]: a presigned link to any client's document,
 * good for two minutes, answered as a 302 so a plain link in the order modal
 * works. Contract sections 6 and 9.
 *
 * The file is served inline by default, so the firm can open it in a tab and
 * read it there (2026-09-22, Patrícia's request: a photograph or a PDF was
 * only downloadable before). `?download=1` asks for the same file as an
 * attachment, which is the second link on every row of the list.
 *
 * A pending row has no confirmed object behind it yet and answers 404 like
 * an unknown id. Every opening is one line in the server log, with which of
 * the two it was.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
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

    const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
    const { url } = await presignDownload({
      key: doc.storage_key,
      fileName: doc.file_name,
      contentType: doc.mime_type,
      disposition,
    });
    audit(admin, "document.download", id, disposition);

    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
