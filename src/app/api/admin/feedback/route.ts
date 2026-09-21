import {
  FEEDBACK_MAX_PAGE_URL,
  FEEDBACK_MAX_TEXT,
  isFeedbackPriority,
  isFeedbackStatus,
  sendFeedbackEmail,
  type AdminFeedbackRow,
  type FeedbackPriority,
} from "@/lib/email/feedback";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/admin-user";

import { INVALID_BODY, audit, errorResponse, isUuid, readJson, refuse, requestOrigin } from "../_lib/http";

/**
 * The admin feedback channel (supabase/migrations/0010_admin_feedback.sql,
 * src/lib/email/feedback.ts). Admin only, like everything under /api/admin.
 *
 * POST, body `{ pageUrl?, expected?, happened?, priority }`:
 *   saves one note for the signed in admin. `expected` and `happened` are at
 *   most 2000 characters each and at least one of them must say something;
 *   `pageUrl` (the screen) is at most 500. Text is trimmed and control
 *   characters are dropped (line breaks survive in the two answers). Then
 *   the note is emailed to FEEDBACK_TO, best effort. 201 `{ id }`.
 *
 * PATCH, body `{ id, status }`: moves a note to open, planned, done or
 *   wont_do. 200 `{ feedback: { id, status } }`.
 *
 * Errors are one line `{ error }`: 400 for a body of the wrong shape, 422 for
 * a value out of bounds, 404 for a note that does not exist, 401 and 403
 * from requireAdmin(), 500 generic (logged) for anything else.
 */

const TOO_LONG_TEXT = `Keep each answer under ${FEEDBACK_MAX_TEXT} characters.`;
const TOO_LONG_PAGE = `Keep the screen under ${FEEDBACK_MAX_PAGE_URL} characters.`;
const EMPTY = "Tell us what you expected or what happened.";
const NO_PRIORITY = "Choose how much it matters.";
const NO_STATUS = "Choose a status.";
const NOT_FOUND = "Note not found.";

/**
 * The text with control characters dropped and trimmed; null when nothing
 * is left. With `multiline`, line breaks and tabs are kept (a Windows line
 * break becomes one `\n`). Written as a loop, not a regex, so no control
 * character sits in the source.
 */
function clean(value: string, multiline: boolean): string | null {
  let out = "";
  for (const char of value.replace(/\r\n?/g, "\n")) {
    const code = char.codePointAt(0) ?? 0;
    const control = code < 32 || code === 127;
    if (!control || (multiline && (char === "\n" || char === "\t"))) out += char;
  }
  return out.trim() || null;
}

/** undefined when the value has the wrong type; null for missing or blank. */
function text(value: unknown, multiline: boolean): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  return clean(value, multiline);
}

type Note = { pageUrl: string | null; expected: string | null; happened: string | null; priority: FeedbackPriority };

function parseNote(body: Record<string, unknown>): { note: Note } | { status: 400 | 422; error: string } {
  const pageUrl = text(body.pageUrl, false);
  const expected = text(body.expected, true);
  const happened = text(body.happened, true);
  if (pageUrl === undefined || expected === undefined || happened === undefined) {
    return { status: 400, error: INVALID_BODY };
  }
  if ((expected?.length ?? 0) > FEEDBACK_MAX_TEXT || (happened?.length ?? 0) > FEEDBACK_MAX_TEXT) {
    return { status: 422, error: TOO_LONG_TEXT };
  }
  if (!expected && !happened) return { status: 422, error: EMPTY };
  if ((pageUrl?.length ?? 0) > FEEDBACK_MAX_PAGE_URL) return { status: 422, error: TOO_LONG_PAGE };
  if (!isFeedbackPriority(body.priority)) return { status: 422, error: NO_PRIORITY };
  return { note: { pageUrl, expected, happened, priority: body.priority } };
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();

    const body = await readJson(request);
    if (!body) return refuse(400, INVALID_BODY);

    const parsed = parseNote(body);
    if ("error" in parsed) return refuse(parsed.status, parsed.error);
    const { note } = parsed;

    const db = createAdminClient();
    const { data, error } = await db
      .from("admin_feedback")
      .insert({
        user_id: admin.id,
        page_url: note.pageUrl,
        expected: note.expected,
        happened: note.happened,
        priority: note.priority,
      })
      .select("id, created_at")
      .single();
    if (error) throw new Error(`admin_feedback: ${error.message}`);
    const row = data as Pick<AdminFeedbackRow, "id" | "created_at">;

    audit(admin, "feedback.create", row.id, note.priority);

    await sendFeedbackEmail({
      id: row.id,
      ...note,
      senderEmail: admin.email,
      createdAt: row.created_at,
      origin: requestOrigin(request),
    });

    return Response.json({ id: row.id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();

    const body = await readJson(request);
    if (!body) return refuse(400, INVALID_BODY);
    if (!isUuid(body.id)) return refuse(404, NOT_FOUND);
    if (!isFeedbackStatus(body.status)) return refuse(422, NO_STATUS);

    const db = createAdminClient();
    const { data, error } = await db
      .from("admin_feedback")
      .update({ status: body.status })
      .eq("id", body.id)
      .select("id, status")
      .maybeSingle();
    if (error) throw new Error(`admin_feedback: ${error.message}`);
    if (!data) return refuse(404, NOT_FOUND);

    const row = data as Pick<AdminFeedbackRow, "id" | "status">;
    audit(admin, "feedback.status", row.id, row.status);
    return Response.json({ feedback: { id: row.id, status: row.status } });
  } catch (error) {
    return errorResponse(error);
  }
}
