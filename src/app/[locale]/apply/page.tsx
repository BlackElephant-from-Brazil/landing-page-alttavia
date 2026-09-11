import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";

import { ApplyWizard, Skeleton } from "@/components/apply/apply-wizard";
import { SiteFooter } from "@/components/bank/site-footer";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";
import { APPLY_PATH, applyCopy, FALLBACK_SERVICES } from "@/content/apply";
import { SEED_QUESTIONS } from "@/lib/apply/questions";
import { getActiveQuestions, getActiveServices } from "@/lib/db/queries";
import type { QuestionRow, ServiceRow } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: applyCopy.meta.title,
  description: applyCopy.meta.description,
  robots: { index: false, follow: true },
};

type Props = { params: Promise<{ locale: string }> };

/**
 * The questions and services the wizard renders: the database's when it
 * answers, the code's seeds when it does not (unreachable, misconfigured,
 * or empty tables). Nothing here throws: the wizard must render either way,
 * and the visitor never sees a difference for the seeded content.
 */
async function loadContent(): Promise<{ questions: readonly QuestionRow[]; services: readonly ServiceRow[] }> {
  try {
    const db = await createClient();
    const [questions, services] = await Promise.all([getActiveQuestions(db), getActiveServices(db)]);
    return {
      questions: questions.length > 0 ? questions : SEED_QUESTIONS,
      services: services.length > 0 ? services : FALLBACK_SERVICES,
    };
  } catch (err) {
    console.error("apply: falling back to the seeded questions and services:", err);
    return { questions: SEED_QUESTIONS, services: FALLBACK_SERVICES };
  }
}

/**
 * The qualification wizard. English only, like the landing: other locales
 * land on the English route. Search params (`?step=`, `?product=`) are read on
 * the client so the page itself never depends on them.
 *
 * The bottom padding on the wrapper reserves room for the wizard's fixed
 * Back/Continue bar on phones, the same way the landing pads for its sticky
 * CTA. Nothing else from the landing chrome is rendered here: no sticky CTA,
 * no structured data, no marketing header.
 */
export default async function ApplyPage({ params }: Props) {
  const { locale } = await params;
  if (locale !== "en") redirect(APPLY_PATH);

  const { questions, services } = await loadContent();

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
            <ApplyWizard questions={questions} services={services} />
          </Suspense>
        </Container>
      </main>

      <SiteFooter />
    </div>
  );
}
