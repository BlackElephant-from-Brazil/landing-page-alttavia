import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * The Supabase client that bypasses row level security. Secret key, server
 * only: the `server-only` import above makes the build fail if a client
 * component ever pulls this in.
 *
 * Used by route handlers to write rows that carry money or status
 * (user_services, user_answers, user_documents, user_service_events) after
 * they have verified the session with getUser() and computed the values
 * themselves. Never trust a product, price or user id that came from the
 * browser.
 *
 * No session, no auto refresh: this client acts as the service, not as a
 * user, and a fresh instance per call is cheap.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set. See .env.example.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
