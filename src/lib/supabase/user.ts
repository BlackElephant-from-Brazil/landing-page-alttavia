import "server-only";

import { createClient } from "./server";

export type SessionUser = {
  id: string;
  email: string;
};

/**
 * The signed in user for server code, or null. Route handlers call this
 * first and answer 401 on null; pages call it to render for one person.
 *
 * `getUser()` asks Supabase Auth to validate the token, so it is the check
 * to trust, unlike reading the cookie's own claims. An account without an
 * email cannot exist here (login is by email code), so a user with none is
 * treated as signed out rather than typed as optional everywhere.
 */
export async function getUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return null;
  return { id: user.id, email: user.email };
}
