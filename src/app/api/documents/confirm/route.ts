import { NextResponse } from "next/server";

import { DocumentError, confirmDocumentUpload, loadOwnDocument } from "@/lib/documents/confirm";
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
 * Everything the upload sets off lives in src/lib/documents/confirm.ts,
 * shared with POST /api/documents/upload, the fallback that writes the bytes
 * itself: the file this one replaces is dropped, and when the upload filled
 * the last required slot the team gets "Documents ready to review"
 * (src/lib/orders/notify.ts). A replacement for a file that was rejected
 * completes the set again and sends again; swapping a file that was only
 * waiting for review changes nothing about the set and sends nothing. The
 * no-op path sends nothing either, and a failed email never fails the upload.
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
    const { document, order } = await loadOwnDocument(admin, documentId, user.id);
    const confirmed = await confirmDocumentUpload({
      db: admin,
      document,
      order,
      origin: requestOrigin(request),
    });

    return NextResponse.json({ document: confirmed });
  } catch (error) {
    if (error instanceof DocumentError) return refuse(error.status, error.message);
    console.error("[documents/confirm]", error);
    return refuse(500, "Something did not work. Try again.");
  }
}
