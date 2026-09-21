import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminLoginForm } from "@/components/admin/login-form";
import { Container } from "@/components/ui/container";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { Logo } from "@/components/ui/logo";
import { PASSWORD_REQUIRED, getUserWithRole } from "@/lib/supabase/admin-user";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

const LOGIN_PATH = "/admin/login";
const DEFAULT_NEXT = "/admin";
const CLIENT_DASHBOARD_PATH = "/en/dashboard";

type Props = {
  searchParams: Promise<{ next?: string | string[] }>;
};

const copy = {
  eyebrow: "Alttavia · Admin",
  heading: "Sign in",
  lead: "The firm's side of the platform. Clients sign in with a code on the client area instead.",
  back: "Back to the site",
  backAria: "Back to the main page",
} as const;

/**
 * Only a path under /admin on this site, and never the login page itself
 * (that would loop). Anything else falls back to the overview. A value that
 * starts with "/admin" cannot be protocol relative ("//host"), so this one
 * check also keeps open redirects out; "/administrator" is refused because
 * the next character must end the path or start a segment.
 */
function safeNext(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\/admin(\/|\?|$)/.test(raw)) return DEFAULT_NEXT;
  if (raw === LOGIN_PATH || raw.startsWith(`${LOGIN_PATH}?`) || raw.startsWith(`${LOGIN_PATH}/`)) {
    return DEFAULT_NEXT;
  }
  if (/[\s\\]/.test(raw)) return DEFAULT_NEXT;
  return raw;
}

/**
 * Admin sign in with a password. Contract (docs/admin-contract.md) section 4.
 *
 * Lives in the `(admin-login)` route group rather than under src/app/admin
 * so the admin layout's guard (no user goes to this page) does not wrap it;
 * the URL is still /admin/login. A signed in admin skips the form and goes
 * to `next`, which defaults to /admin; a signed in client goes to their own
 * dashboard. An admin whose session came from an emailed code (the client
 * area's sign in, or a password reset code) stays here: the form opens
 * with "Sign in with your password." and their email filled in, and a
 * password sign in replaces that session. Dynamic by nature (cookies are
 * read).
 *
 * "Forgot your password?" runs entirely inside the form (a mode switch, no
 * other URL), so src/proxy.ts needs no exception for it.
 */
export default async function AdminLoginPage({ searchParams }: Props) {
  const query = await searchParams;
  const next = safeNext(query.next);

  const user = await getUserWithRole();
  const needsPassword = user?.needsPassword === true;
  if (user && !needsPassword) redirect(user.role === "admin" ? next : CLIENT_DASHBOARD_PATH);

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-navy text-white">
        <Container size="wide" className="flex h-16 items-center justify-between lg:h-20">
          <Link href="/en" aria-label={copy.backAria}>
            <Logo tone="cream" className="h-7 w-auto lg:h-8" />
          </Link>
          <Link
            href="/en"
            className="inline-flex items-center gap-2 text-sm font-medium text-white/70 transition-colors duration-200 hover:text-gold-light"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {copy.back}
          </Link>
        </Container>
      </header>

      <main className="flex-1 bg-paper py-12 lg:py-20">
        <Container size="narrow">
          <EyebrowSolo>{copy.eyebrow}</EyebrowSolo>
          <h1 className="mt-4 font-serif text-[clamp(1.6rem,3.3vw,2.25rem)] leading-tight text-balance text-navy">
            {copy.heading}
          </h1>
          <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-navy-soft">{copy.lead}</p>
          <AdminLoginForm
            next={next}
            notice={needsPassword ? PASSWORD_REQUIRED : undefined}
            defaultEmail={needsPassword ? user?.email : undefined}
          />
        </Container>
      </main>
    </div>
  );
}
