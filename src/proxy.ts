import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every page and route handler (see `config.matcher`) and does
 * two things:
 *
 * 1. Refreshes the Supabase session. Server components cannot write cookies,
 *    so this is the one place a refreshed token reliably reaches the browser.
 *    `getUser()` is called before any response is produced, as @supabase/ssr
 *    requires, and every cookie it wants to set is copied onto both the
 *    forwarded request and the response.
 * 2. Sends a visitor without a session away from the client area:
 *    /en/dashboard and everything under it redirect to /en/login with the
 *    original path in `next`, so login can bring them back.
 * 3. Does the same for the firm's side: /admin and everything under it,
 *    except /admin/login itself, redirect to /admin/login with the path in
 *    `next`. The role is not checked here (that needs a database read);
 *    src/app/admin/layout.tsx sends a signed in client away.
 *
 * This is an optimistic check only. Pages and route handlers still call
 * getUser() themselves before reading or writing anything for a user.
 *
 * The refreshed session cookies are SameSite lax and, in a production build,
 * Secure: the same options as src/lib/supabase/client.ts and server.ts, so a
 * cookie written here is never weaker than one written there.
 *
 * Next.js 16: this file replaces middleware.ts and runs on the Node.js
 * runtime.
 */

const DASHBOARD = /^\/en\/dashboard(\/|$)/;
const LOGIN_PATH = "/en/login";
const ADMIN = /^\/admin(\/|$)/;
const ADMIN_LOGIN = /^\/admin\/login(\/|$)/;
const ADMIN_LOGIN_PATH = "/admin/login";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  let signedIn = false;

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookieOptions: { sameSite: "lax", secure: process.env.NODE_ENV === "production" },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [name, value] of Object.entries(headers)) {
            response.headers.set(name, value);
          }
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = user !== null;
  }

  const { pathname } = request.nextUrl;
  if (!signedIn && DASHBOARD.test(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = LOGIN_PATH;
    login.search = "";
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  if (!signedIn && ADMIN.test(pathname) && !ADMIN_LOGIN.test(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = ADMIN_LOGIN_PATH;
    login.search = "";
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next's own assets, the favicon and any file with an
    // extension (images, fonts, robots.txt, sitemap.xml). Those never carry
    // a session and would only add a Supabase round trip.
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.[^/]+$).*)",
  ],
};
