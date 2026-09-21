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
 *
 * Session cookies: SameSite lax (the library default, stated here so it is
 * not lost) and Secure in a production build, so the session never travels
 * over plain http. Development stays without Secure: a phone on the LAN opens
 * http://192.168.x.y, where a browser drops Secure cookies. The server
 * client (server.ts) and src/proxy.ts set the same options; keep the three
 * in step.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set. See .env.example.",
    );
  }
  return createBrowserClient(url, key, {
    cookieOptions: { sameSite: "lax", secure: process.env.NODE_ENV === "production" },
  });
}
