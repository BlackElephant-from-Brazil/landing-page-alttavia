import { NextResponse } from "next/server";

import { getUserService } from "@/lib/db/queries";
import type { UserDocumentRow } from "@/lib/db/types";
import { presignDownload } from "@/lib/r2/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/user";

/**
 * GET /api/documents/[id]
 *
 * Opens one of the caller's own files: a presigned GetObject URL, good for
 * two minutes, answered as a 302 so a plain link in the dashboard works.
 *
 * Anything that is not the caller's file answers 404, including files that
 * exist but belong to someone else: a document id is not something another
 * user should be able to confirm. A visitor without a session is sent to
 * login, because this URL is opened by a click, not by fetch.
 *
 * `ctx.params` is a Promise in this Next.js.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOGIN = "/en/login?next=/en/dashboard";

function refuse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL(LOGIN, request.url), 302);

  const { id } = await ctx.params;
  if (!UUID.test(id)) return refuse(404, "This file is not on record.");

  try {
    const admin = createAdminClient();

    const { data, error } = await admin.from("user_documents").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`user_documents: ${error.message}`);
    const doc = data as UserDocumentRow | null;
    if (!doc) return refuse(404, "This file is not on record.");

    const order = await getUserService(admin, doc.user_service_id, user.id);
    if (!order) return refuse(404, "This file is not on record.");

    // A pending row has no confirmed object behind it yet.
    if (doc.status === "pending") return refuse(404, "This file has not arrived yet.");

    const { url } = await presignDownload({
      key: doc.storage_key,
      fileName: doc.file_name,
      contentType: doc.mime_type,
    });

    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[documents/[id]]", error);
    return refuse(500, "Something did not work. Try again.");
  }
}
