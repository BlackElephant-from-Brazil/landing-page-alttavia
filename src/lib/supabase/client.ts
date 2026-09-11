"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * The Supabase client for client components: the email and code steps of
 * login, and nothing that reads order data (the dashboard renders on the
 * server). Publishable key only; rows come back filtered by row level
 * security.
 *
 * `createBrowserClient` keeps one instance per page, so calling this in
 * several components is fine.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set. See .env.example.",
    );
  }
  return createBrowserClient(url, key);
}
