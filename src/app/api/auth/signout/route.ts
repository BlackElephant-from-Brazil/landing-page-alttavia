import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/signout
 *
 * Ends the Supabase session and sends the browser to the landing. Reached by
 * the plain form in src/components/auth/sign-out-button.tsx, so it must work
 * as a form POST: 303 See Other turns the redirect into a GET.
 *
 * `signOut()` on the cookie bound server client clears the auth cookies
 * through `cookies().set`, which Next merges into this response. Signing out
 * a request that has no session is harmless and still redirects.
 *
 * The Location is relative on purpose. Building it from `request.url` gave
 * `http://0.0.0.0:3000/en` on a dev server started with `-H 0.0.0.0`, which
 * no browser can open, and building it from the Host header would trust a
 * header the client controls. Browsers resolve a relative Location against
 * the page that posted the form, which is exactly where we want to stay.
 */
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return new Response(null, { status: 303, headers: { Location: "/en" } });
}
