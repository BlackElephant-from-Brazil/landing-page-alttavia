/**
 * What an admin may send when they create or edit a client account. Pure,
 * no database: the routes under /api/admin/users call this first and answer
 * 422 with the one line it names.
 *
 *   const result = validateNewAccount(body);
 *   if (!result.ok) return refuse(422, result.error);
 *
 * The rules are the ones the database and Supabase Auth hold anyway: an
 * address that looks like an address, a name that fits the column, a phone
 * that is optional. Nothing here is a format check on the phone number: the
 * firm's clients write theirs in every style there is.
 *
 * A patch says what it wants changed. A key that is absent is left alone; a
 * phone sent empty clears it, because "no phone" is a value an admin must be
 * able to set. An empty patch is refused, so a form that sends nothing gets
 * a line instead of a silent success.
 */

export const MAX_NAME_LENGTH = 120;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_PHONE_LENGTH = 40;

/** Deliberately loose: Supabase Auth is the one that decides in the end. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

export type NewAccountInput = {
  email: string;
  fullName: string;
  phone: string | null;
};

export type AccountPatch = {
  email?: string;
  fullName?: string;
  phone?: string | null;
};

const copy = {
  email: "Enter an email address.",
  emailLong: "That email address is too long.",
  name: "Enter the client's name.",
  nameLong: `Keep the name under ${MAX_NAME_LENGTH} characters.`,
  phoneLong: `Keep the phone number under ${MAX_PHONE_LENGTH} characters.`,
  nothing: "Change something first.",
} as const;

function text(raw: unknown): string | null {
  return typeof raw === "string" ? raw.trim() : null;
}

/** An email address as it is stored: trimmed and lower cased. Null when it is not one. */
export function normalizeEmail(raw: unknown): string | null {
  const value = text(raw)?.toLowerCase();
  if (!value || value.length > MAX_EMAIL_LENGTH || !EMAIL.test(value)) return null;
  return value;
}

export function validateNewAccount(body: Record<string, unknown>): Validated<NewAccountInput> {
  const email = normalizeEmail(body.email);
  if (!email) {
    return { ok: false, error: text(body.email) && text(body.email)!.length > MAX_EMAIL_LENGTH ? copy.emailLong : copy.email };
  }

  // `fullName` is what the dialog sends; `full_name` is accepted so a row
  // read from the database can be sent straight back.
  const fullName = text(body.fullName) ?? text(body.full_name) ?? "";
  if (!fullName) return { ok: false, error: copy.name };
  if (fullName.length > MAX_NAME_LENGTH) return { ok: false, error: copy.nameLong };

  const phoneRaw = text(body.phone) ?? "";
  if (phoneRaw.length > MAX_PHONE_LENGTH) return { ok: false, error: copy.phoneLong };

  return { ok: true, value: { email, fullName, phone: phoneRaw || null } };
}

export function validateAccountPatch(body: Record<string, unknown>): Validated<AccountPatch> {
  const patch: AccountPatch = {};

  if ("email" in body) {
    const email = normalizeEmail(body.email);
    if (!email) {
      return { ok: false, error: text(body.email) && text(body.email)!.length > MAX_EMAIL_LENGTH ? copy.emailLong : copy.email };
    }
    patch.email = email;
  }

  const nameKey = "fullName" in body ? "fullName" : "full_name" in body ? "full_name" : null;
  if (nameKey) {
    const fullName = text(body[nameKey]) ?? "";
    if (!fullName) return { ok: false, error: copy.name };
    if (fullName.length > MAX_NAME_LENGTH) return { ok: false, error: copy.nameLong };
    patch.fullName = fullName;
  }

  if ("phone" in body) {
    const phone = text(body.phone) ?? "";
    if (phone.length > MAX_PHONE_LENGTH) return { ok: false, error: copy.phoneLong };
    patch.phone = phone || null;
  }

  if (Object.keys(patch).length === 0) return { ok: false, error: copy.nothing };
  return { ok: true, value: patch };
}
