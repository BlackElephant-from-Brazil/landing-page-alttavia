import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { LoginFlow } from "@/components/auth/login-flow";
import { SiteFooter } from "@/components/bank/site-footer";
import { Container } from "@/components/ui/container";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { Logo } from "@/components/ui/logo";
import { applyCopy } from "@/content/apply";
import { getUser } from "@/lib/supabase/user";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Alttavia client area with a code sent to your email.",
  robots: { index: false, follow: false },
};

const LOGIN_PATH = "/en/login";
const DEFAULT_NEXT = "/en/dashboard";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
};

/**
 * Only a path on this site, under /en/, and never the login page itself
 * (that would loop). Anything else falls back to the dashboard. A value that
 * starts with "/en/" cannot be protocol relative ("//host"), so this one
 * check also keeps open redirects out.
 */
function safeNext(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/en/")) return DEFAULT_NEXT;
  if (raw === LOGIN_PATH || raw.startsWith(`${LOGIN_PATH}?`) || raw.startsWith(`${LOGIN_PATH}/`)) {
    return DEFAULT_NEXT;
  }
  if (/[\s\\]/.test(raw)) return DEFAULT_NEXT;
  return raw;
}

/**
 * Standalone sign in: email, then the 6 digit code, then `?next=` or the
 * dashboard. English only, like /en/apply; other locales land on the English
 * route with the same `next`. A visitor who already has a session skips the
 * form. Same chrome as the apply page: logo, a way back, paper background,
 * the site footer. Dynamic by nature (cookies are read).
 */
export default async function LoginPage({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const next = safeNext(query.next);

  if (locale !== "en") {
    redirect(next === DEFAULT_NEXT ? LOGIN_PATH : `${LOGIN_PATH}?next=${encodeURIComponent(next)}`);
  }

  const user = await getUser();
  if (user) redirect(next);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-navy/10 bg-white">
        <Container size="wide" className="flex h-16 items-center justify-between lg:h-20">
          <Link href="/en" aria-label={applyCopy.chrome.backAria}>
            <Logo className="h-7 w-auto lg:h-8" />
          </Link>
          <Link
            href="/en"
            className="inline-flex items-center gap-2 text-sm font-medium text-navy-soft transition-colors duration-200 hover:text-gold-dark"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {applyCopy.chrome.back}
          </Link>
        </Container>
      </header>

      <main className="flex-1 bg-paper py-12 lg:py-20">
        <Container size="narrow">
          <EyebrowSolo>Client area</EyebrowSolo>
          <div className="mt-4">
            <LoginFlow next={next} />
          </div>
        </Container>
      </main>

      <SiteFooter />
    </div>
  );
}
