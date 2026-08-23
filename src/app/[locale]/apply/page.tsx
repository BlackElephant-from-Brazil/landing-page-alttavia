import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";

import { ApplyWizard, Skeleton } from "@/components/apply/apply-wizard";
import { SiteFooter } from "@/components/bank/site-footer";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";
import { APPLY_PATH, applyCopy } from "@/content/apply";

export const metadata: Metadata = {
  title: applyCopy.meta.title,
  description: applyCopy.meta.description,
  robots: { index: false, follow: true },
};

type Props = { params: Promise<{ locale: string }> };

/**
 * The qualification wizard. English only, like the landing: other locales
 * land on the English route. Search params (`?step=`, `?product=`) are read on
 * the client so this page stays static.
 *
 * The bottom padding on the wrapper reserves room for the wizard's fixed
 * Back/Continue bar on phones, the same way the landing pads for its sticky
 * CTA. Nothing else from the landing chrome is rendered here: no sticky CTA,
 * no structured data, no marketing header.
 */
export default async function ApplyPage({ params }: Props) {
  const { locale } = await params;
  if (locale !== "en") redirect(APPLY_PATH);

  return (
    <div className="flex flex-1 flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0">
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
          <Suspense fallback={<Skeleton />}>
            <ApplyWizard />
          </Suspense>
        </Container>
      </main>

      <SiteFooter />
    </div>
  );
}
