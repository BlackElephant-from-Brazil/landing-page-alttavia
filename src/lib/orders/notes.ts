import { sendEmail } from "@/lib/email/send";
import { dashboardUrl, pendencyPosted } from "@/lib/email/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NoteAudience, UserRow, UserServiceNoteRow, UserServiceRow } from "@/lib/db/types";

/**
 * Pendencies and internal notes on an order. Contract
 * (docs/admin-contract.md) sections 6 and 8.
 *
 *   addNote(orderId, adminId, "client", "Send the second page of the lease.", origin)
 *   addNote(orderId, adminId, "internal", "Called Finanças, callback Monday.")
 *   resolveNote(noteId)
 *
 * A `client` note is a pendency: the dashboard shows it under "Pending from
 * you" until `resolved_at` is set, and the order's owner gets an email when
 * it is posted (best effort: a failed email is logged, never thrown). An
 * `internal` note is only ever seen by admins and sends nothing.
 *
 * Resolving is idempotent: a note already resolved is returned as it is.
 */

export const MAX_NOTE_LENGTH = 4000;

export type NoteErrorCode = "order_not_found" | "note_not_found" | "empty_body";

export class NoteError extends Error {
  readonly code: NoteErrorCode;
  readonly status: 404 | 422;

  constructor(code: NoteErrorCode, status: 404 | 422, message: string) {
    super(message);
    this.name = "NoteError";
    this.code = code;
    this.status = status;
  }
}

export type AddNoteResult = {
  note: UserServiceNoteRow;
  /** True when the pendency email was accepted by the sender. */
  emailed: boolean;
};

export async function addNote(
  orderId: string,
  actorId: string,
  audience: NoteAudience,
  body: string,
  origin?: string | null,
): Promise<AddNoteResult> {
  const text = body.trim();
  if (!text || text.length > MAX_NOTE_LENGTH) {
    throw new NoteError("empty_body", 422, `Write between 1 and ${MAX_NOTE_LENGTH} characters.`);
  }

  const admin = createAdminClient();

  const { data: orderData, error: orderError } = await admin
    .from("user_services")
    .select("id, user_id")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) throw new Error(`addNote: ${orderError.message}`);
  const order = orderData as Pick<UserServiceRow, "id" | "user_id"> | null;
  if (!order) throw new NoteError("order_not_found", 404, "Order not found.");

  const { data: inserted, error: insertError } = await admin
    .from("user_service_notes")
    .insert({ user_service_id: order.id, author_id: actorId, audience, body: text })
    .select("*")
    .single();
  if (insertError || !inserted) throw new Error(`addNote: ${insertError?.message ?? "no row"}`);
  const note = inserted as UserServiceNoteRow;

  let emailed = false;
  if (audience === "client") {
    const { data: userData, error: userError } = await admin
      .from("users")
      .select("email")
      .eq("id", order.user_id)
      .maybeSingle();
    if (userError) console.error(`addNote: owner lookup failed for ${order.id}: ${userError.message}`);
    const email = (userData as Pick<UserRow, "email"> | null)?.email;
    if (email) {
      const content = pendencyPosted({ body: text, dashboardUrl: dashboardUrl(origin) });
      const sent = await sendEmail({ to: email, ...content });
      emailed = sent.ok;
    }
  }

  return { note, emailed };
}

export async function resolveNote(noteId: string): Promise<UserServiceNoteRow> {
  const admin = createAdminClient();

  const { data: noteData, error: noteError } = await admin
    .from("user_service_notes")
    .select("*")
    .eq("id", noteId)
    .maybeSingle();
  if (noteError) throw new Error(`resolveNote: ${noteError.message}`);
  const note = noteData as UserServiceNoteRow | null;
  if (!note) throw new NoteError("note_not_found", 404, "Note not found.");
  if (note.resolved_at) return note;

  const { data: updatedRows, error: updateError } = await admin
    .from("user_service_notes")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", note.id)
    .is("resolved_at", null)
    .select("*");
  if (updateError) throw new Error(`resolveNote: ${updateError.message}`);
  const updated = (updatedRows ?? [])[0] as UserServiceNoteRow | undefined;

  // No row means someone resolved it between our read and our write, which
  // is the same outcome.
  return updated ?? { ...note, resolved_at: new Date().toISOString() };
}
