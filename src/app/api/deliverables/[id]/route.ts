import { NextResponse } from "next/server";

import { getUserService } from "@/lib/db/queries";
import type { UserServiceDeliverableRow } from "@/lib/db/types";
import { presignDownload } from "@/lib/r2/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/user";

/**
 * GET /api/deliverables/[id]. Admin contract section 6, "Client routes
 * added".
 *
 * Opens one of the files the firm returned to the caller: a presigned
 * GetObject URL, good for two minutes, answered as a 302 so a plain link on
 * the order view works. Mirrors /api/documents/[id].
 *
 * Only a `ready` deliverable on one of the caller's own orders is served.
 * Everything else answers 404, a foreign order's file included: a
 * deliverable id is not something another account should be able to
 * confirm. A visitor without a session is sent to login, because this URL
 * is opened by a click, not by fetch.
 *
 * `ctx.params` is a Promise in this Next.js.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOGIN = "/en/login?next=/en/dashboard";
const NOT_FOUND = "This file is not on record.";

function refuse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL(LOGIN, request.url), 302);

  const { id } = await ctx.params;
  if (!UUID.test(id)) return refuse(404, NOT_FOUND);

  try {
    const admin = createAdminClient();

    const { data, error } = await admin.from("user_service_deliverables").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`user_service_deliverables: ${error.message}`);
    const file = data as UserServiceDeliverableRow | null;
    if (!file) return refuse(404, NOT_FOUND);

    const order = await getUserService(admin, file.user_service_id, user.id);
    if (!order) return refuse(404, NOT_FOUND);

    if (file.status !== "ready" || !file.storage_key) return refuse(404, NOT_FOUND);

    const { url } = await presignDownload({
      key: file.storage_key,
      fileName: file.file_name ?? undefined,
      contentType: file.mime_type ?? undefined,
    });

    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[deliverables/[id]]", error);
    return refuse(500, "Something did not work. Try again.");
  }
}
