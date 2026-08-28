import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";

import { SuccessPanel } from "@/components/apply/success-panel";
import { SiteFooter } from "@/components/bank/site-footer";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";
import { APPLY_PATH, applyCopy } from "@/content/apply";

export const metadata: Metadata = {
  title: applyCopy.success.meta.title,
  description: applyCopy.success.meta.description,
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ locale: string }> };

/**
 * Stripe returns the buyer here. English only, like the rest of the funnel.
 *
 * The page reads nothing from Stripe: with Payment Links there is no API key
 * on our side, so it confirms the payment the buyer just made and explains the
 * sequence rather than echoing order details it cannot verify.
 */
export default async function ApplySuccessPage({ params }: Props) {
  const { locale } = await params;
  if (locale !== "en") redirect(`${APPLY_PATH}/success`);

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
            {applyCopy.success.backHome}
          </Link>
        </Container>
      </header>

      <main className="flex-1 bg-paper py-12 lg:py-20">
        <Container size="narrow">
          <Suspense fallback={null}>
            <SuccessPanel />
          </Suspense>
        </Container>
      </main>

      <SiteFooter />
    </div>
  );
}
