import "server-only";

import { getUserDeletionCounts } from "@/lib/db/admin-queries";
import type { Db } from "@/lib/db/queries";
import type { AdminUserCounts, UserRow } from "@/lib/db/types";
import { deleteOrderFiles } from "@/lib/r2/prefix";

import type { AccountPatch, NewAccountInput } from "./account-input";

/**
 * Client accounts, as an admin makes and unmakes them. Contract
 * (docs/admin-contract.md) section 6, "Users".
 *
 *   createClientAccount(admin, input)          -> { userId }
 *   updateClientAccount(admin, id, patch)      -> the profile as it now is
 *   deleteClientAccount(admin, id, options)    -> what went
 *
 * Every call takes the admin client (secret key) the route handler built
 * after requireAdmin(), because none of these tables has an insert, update
 * or delete policy for anybody.
 *
 * Two stores hold an account: `auth.users`, which authenticates it, and
 * `public.users`, the profile. The trigger `on_auth_user_change`
 * (0001_schema.sql) mirrors the id and the email from the first into the
 * second on insert and on an email change, so creating an auth user is
 * enough to get a profile; the name and the phone are then written here.
 * The role of a new account is the column's default, `client`.
 *
 * An administrator account is never touched here. Its password, and only
 * its own session, changes it (/admin/settings), and deleting one would take
 * the events, reviews and returned files it signed with it.
 *
 * Refusals are AccountError with a status and a line the admin may read; a
 * database or Auth failure throws a plain Error, which the route logs and
 * answers 500.
 */

export type AccountErrorCode =
  | "not_found"
  | "email_taken"
  | "is_admin"
  | "is_self"
  | "email_mismatch";

export class AccountError extends Error {
  readonly code: AccountErrorCode;
  readonly status: 403 | 404 | 409;

  constructor(code: AccountErrorCode, status: 403 | 404 | 409, message: string) {
    super(message);
    this.name = "AccountError";
    this.code = code;
    this.status = status;
  }
}

const copy = {
  notFound: "This user is not on record.",
  taken: "An account with this email already exists.",
  isAdmin: "This is an administrator account. Change it in Settings.",
  isSelf: "You cannot delete the account you are signed in with.",
  mismatch: "The email does not match this account.",
} as const;

/** Chunk size for `in (...)` filters, as scripts/purge-test-data.mjs uses. */
const CHUNK = 50;

function chunks<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

type AuthError = { message?: string; code?: string; status?: number };

/**
 * Supabase says the address is already registered, whichever way it says it.
 *
 * The code and the wording only. A bare `status === 422` used to count too,
 * but Auth answers 422 for other refusals as well, an address its own
 * validator will not take for instance, and the admin was then told to pick
 * another address for a reason that was never that. Anything else falls
 * through to the plain Error, which the route logs and answers 500 for.
 */
export function isEmailTaken(error: AuthError): boolean {
  return error.code === "email_exists" || /already (been )?registered|already exists/i.test(error.message ?? "");
}

/** A unique index refused the row: the address is on another profile. */
function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" || /duplicate key value/i.test(error.message ?? "");
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * A client account the firm made for someone. No email is sent from here:
 * the client signs in later with a code, like anyone else, from /en/login.
 */
export async function createClientAccount(admin: Db, input: NewAccountInput): Promise<{ userId: string }> {
  const created = await admin.auth.admin.createUser({ email: input.email, email_confirm: true });
  if (created.error) {
    if (isEmailTaken(created.error)) throw new AccountError("email_taken", 409, copy.taken);
    throw new Error(`createUser: ${created.error.message}`);
  }
  const userId = created.data.user?.id;
  if (!userId) throw new Error("createUser: Supabase returned no user");

  // The mirror trigger has written (id, email); this adds what it cannot
  // know, and carries the insert for a project where the trigger is absent.
  const { error } = await admin
    .from("users")
    .upsert(
      { id: userId, email: input.email, full_name: input.fullName, phone: input.phone, role: "client" },
      { onConflict: "id" },
    );
  if (error) {
    // The Auth user exists and the profile does not. Left alone it is an
    // account nobody can see in /admin, nobody can delete through the app,
    // and whose address no second attempt can ever use again: the create
    // would answer "already exists" and the delete "not on record". So it
    // goes back, and only then is the failure reported.
    await rollbackAuthUser(admin, userId);
    if (isUniqueViolation(error)) throw new AccountError("email_taken", 409, copy.taken);
    throw new Error(`users: ${error.message}`);
  }

  return { userId };
}

/** Undoes the Auth user of a create that did not finish. Best effort, logged. */
async function rollbackAuthUser(admin: Db, userId: string): Promise<void> {
  try {
    const removed = await admin.auth.admin.deleteUser(userId);
    if (removed.error) {
      console.error(`createClientAccount: auth user ${userId} left behind: ${removed.error.message}`);
    }
  } catch (err) {
    console.error(`createClientAccount: auth user ${userId} left behind:`, err);
  }
}

// ---------------------------------------------------------------------------
// Read one, for the checks the writes share
// ---------------------------------------------------------------------------

type Profile = Pick<UserRow, "id" | "email" | "role">;

async function readProfile(admin: Db, id: string): Promise<Profile> {
  const { data, error } = await admin.from("users").select("id, email, role").eq("id", id).maybeSingle();
  if (error) throw new Error(`users: ${error.message}`);
  const profile = data as Profile | null;
  if (!profile) throw new AccountError("not_found", 404, copy.notFound);
  return profile;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * The name, the phone and the email of a client. The email is changed in
 * Auth first, because that is the address the sign in code goes to, and the
 * profile follows; the trigger writes the same value, so the two agree
 * either way.
 */
export async function updateClientAccount(admin: Db, id: string, patch: AccountPatch): Promise<UserRow> {
  const profile = await readProfile(admin, id);
  if (profile.role === "admin") throw new AccountError("is_admin", 403, copy.isAdmin);

  if (patch.email && patch.email.toLowerCase() !== profile.email.toLowerCase()) {
    const updated = await admin.auth.admin.updateUserById(id, { email: patch.email, email_confirm: true });
    if (updated.error) {
      if (isEmailTaken(updated.error)) throw new AccountError("email_taken", 409, copy.taken);
      throw new Error(`updateUserById: ${updated.error.message}`);
    }
  }

  const values: Record<string, unknown> = {};
  if (patch.email) values.email = patch.email;
  if (patch.fullName !== undefined) values.full_name = patch.fullName;
  if (patch.phone !== undefined) values.phone = patch.phone;

  const { data, error } = await admin.from("users").update(values).eq("id", id).select("*").maybeSingle();
  if (error) {
    if (isUniqueViolation(error)) throw new AccountError("email_taken", 409, copy.taken);
    throw new Error(`users: ${error.message}`);
  }
  if (!data) throw new AccountError("not_found", 404, copy.notFound);
  return data as UserRow;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export type DeleteAccountOptions = {
  /** The admin asking. An admin cannot delete the account they are signed in with. */
  actorId: string;
  /** The email the admin typed to confirm. It must match the account. */
  confirmEmail: string | null;
};

export type DeletedAccount = {
  email: string;
  counts: AdminUserCounts;
  /** Objects actually removed from the bucket, which can exceed the rows. */
  filesDeleted: number;
};

/**
 * Removes a client and everything they own: the files in the bucket first,
 * then the rows from the leaves inwards, then the profile, then the auth
 * user.
 *
 * The database would cascade most of this on its own (every child of
 * `user_services` is `on delete cascade`, and `public.users` cascades from
 * `auth.users`), but each table is named here anyway, in the same order
 * scripts/purge-test-data.mjs uses, so what goes is written down rather than
 * inferred from the schema.
 *
 * The files go first on purpose. A bucket that cannot be reached throws
 * before a single row is deleted, so the account survives intact and the
 * admin can try again; the other way round would leave files that nothing
 * points at.
 */
export async function deleteClientAccount(admin: Db, id: string, options: DeleteAccountOptions): Promise<DeletedAccount> {
  const profile = await readProfile(admin, id);
  if (profile.role === "admin") throw new AccountError("is_admin", 403, copy.isAdmin);
  if (profile.id === options.actorId) throw new AccountError("is_self", 403, copy.isSelf);
  if (!options.confirmEmail || options.confirmEmail.trim().toLowerCase() !== profile.email.toLowerCase()) {
    throw new AccountError("email_mismatch", 409, copy.mismatch);
  }

  const counts = (await getUserDeletionCounts(admin, id)) ?? {
    orders: 0,
    paidOrders: 0,
    documents: 0,
    deliverables: 0,
    agreements: 0,
    answers: 0,
    files: 0,
  };

  const { data: orderData, error: orderError } = await admin.from("user_services").select("id").eq("user_id", id);
  if (orderError) throw new Error(`user_services: ${orderError.message}`);
  const orderIds = ((orderData ?? []) as { id: string }[]).map((row) => row.id);

  let filesDeleted = 0;
  for (const orderId of orderIds) {
    filesDeleted += await deleteOrderFiles(orderId);
  }

  // Leaves first, then the order, so a foreign key never stands in the way
  // of the next statement even where the schema would have cascaded.
  const childTables = [
    "user_service_events",
    "user_documents",
    "user_service_applicants",
    "user_service_contracts",
    "user_service_deliverables",
  ] as const;
  for (const part of chunks(orderIds)) {
    for (const table of childTables) {
      const { error } = await admin.from(table).delete().in("user_service_id", part);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    const { error } = await admin.from("user_services").delete().in("id", part);
    if (error) throw new Error(`user_services: ${error.message}`);
  }

  const { error: answersError } = await admin.from("user_answers").delete().eq("user_id", id);
  if (answersError) throw new Error(`user_answers: ${answersError.message}`);

  const { error: profileError } = await admin.from("users").delete().eq("id", id);
  if (profileError) throw new Error(`users: ${profileError.message}`);

  const removed = await admin.auth.admin.deleteUser(id);
  if (removed.error) throw new Error(`deleteUser: ${removed.error.message}`);

  return { email: profile.email, counts, filesDeleted };
}
