import { NextResponse } from "next/server";

import { getUserService } from "@/lib/db/queries";
import type { UserDocumentRow } from "@/lib/db/types";
import { notifyDocumentsReady } from "@/lib/orders/notify";
import { headObjectSize } from "@/lib/r2/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/user";

/**
 * POST /api/documents/confirm
 *
 * Step two of an upload. The browser has PUT the file to the presigned URL
 * and now asks the server to believe it. The server does not: it asks the
 * bucket (HeadObject) whether the object exists with exactly the size the
 * row was created with, and only then moves the row from `pending` to
 * `uploaded`. A second call on an already uploaded row is a no-op that
 * returns the row, so a retried request never fails.
 *
 * When the upload fills the last required slot of the order, the team inbox
 * gets "Documents ready to review" (src/lib/orders/notify.ts). A replaced
 * file after a rejection can complete the set again and send again, on
 * purpose. The no-op path sends nothing, and a failed email never fails the
 * upload.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refuse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** The origin links inside the email are built on: the site URL when set, else where the request came from. */
function requestOrigin(request: Request): string | null {
  const given = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get("origin");
  if (given) return given;
  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return refuse(401, "Sign in to continue.");

  let documentId = "";
  try {
    const raw = (await request.json()) as { documentId?: unknown };
    if (typeof raw?.documentId === "string") documentId = raw.documentId.trim();
  } catch {
    // handled below
  }
  if (!UUID.test(documentId)) return refuse(400, "Check the file details and try again.");

  try {
    const admin = createAdminClient();

    const { data: docData, error: docError } = await admin
      .from("user_documents")
      .select("*")
      .eq("id", documentId)
      .maybeSingle();
    if (docError) throw new Error(`user_documents: ${docError.message}`);
    const doc = docData as UserDocumentRow | null;
    if (!doc) return refuse(404, "This file is not on record.");

    const order = await getUserService(admin, doc.user_service_id, user.id);
    if (!order) return refuse(403, "This order is not yours.");

    if (doc.status === "uploaded") return NextResponse.json({ document: doc });
    if (doc.status !== "pending") return refuse(409, "This file has already been reviewed.");

    const size = await headObjectSize(doc.storage_key);
    if (size === null || size !== doc.size_bytes) return refuse(422, "Upload incomplete.");

    const { data: updated, error: updateError } = await admin
      .from("user_documents")
      .update({ status: "uploaded", uploaded_at: new Date().toISOString() })
      .eq("id", doc.id)
      .eq("status", "pending")
      .select("*")
      .single();
    if (updateError || !updated) {
      throw new Error(`user_documents update: ${updateError?.message ?? "no row"}`);
    }
    const confirmed = updated as UserDocumentRow;

    // The upload is recorded. When it filled the last required slot, the team
    // hears about it. Best effort: notifyDocumentsReady never throws.
    await notifyDocumentsReady({ order, document: confirmed }, { db: admin, origin: requestOrigin(request) });

    return NextResponse.json({ document: confirmed });
  } catch (error) {
    console.error("[documents/confirm]", error);
    return refuse(500, "Something did not work. Try again.");
  }
}
