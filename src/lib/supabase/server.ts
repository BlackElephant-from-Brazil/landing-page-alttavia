import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * The Supabase client for server components and route handlers, bound to the
 * request's cookies so it sees the same session the browser wrote.
 *
 * Publishable key: rows come back filtered by row level security, which is
 * what a page rendering for one user wants. Anything that writes money or
 * status uses src/lib/supabase/admin.ts instead.
 *
 * A new client per request, never shared: the cookie store belongs to the
 * request. `cookies()` is async in this Next.js, hence the await.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set. See .env.example.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server components cannot set cookies. src/proxy.ts refreshes the
          // session on every request, so a refresh missed here is written
          // there on the next one.
        }
      },
    },
  });
}
