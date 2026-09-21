"use client";

import { RotateCw } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { CONTACT } from "@/content/bank-nif";

/**
 * The page shown when a page below the root layout throws while rendering:
 * the landing, the application form, the client area and the admin alike.
 * src/app/global-error.tsx renders this same component when the root layout
 * itself fails.
 *
 * Calm on purpose: the brand mark, one sentence, Try again. No message and
 * no stack trace reach the screen; in production Next.js sends the browser
 * only a digest for a server error, shown small as a reference the person
 * can quote when they write in, which matches the line in the server log.
 *
 * Try again calls `unstable_retry` (Next.js 16.2), which refreshes the
 * route's server data and renders the segment again; `reset` is the fallback
 * for a boundary that does not pass it.
 */

const copy = {
  eyebrow: "Alttavia Relocation",
  title: "Something did not load.",
  body: "Please try again. If it happens again, write to us at",
  retry: "Try again",
  home: "Go to the home page",
  reference: "Reference",
} as const;

type Props = {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
};

export default function ErrorPage({ error, unstable_retry, reset }: Props) {
  const retry = unstable_retry ?? reset;

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-paper px-4 py-16 sm:py-24">
      <div className="w-full max-w-md text-center">
        <Logo className="mx-auto h-8 w-auto" />

        <div className="mt-10 flex items-center justify-center gap-3 text-[0.72rem] font-medium uppercase tracking-[0.28em] text-gold-dark">
          <span className="inline-block h-px w-8 bg-gold/60" aria-hidden />
          <span>{copy.eyebrow}</span>
          <span className="inline-block h-px w-8 bg-gold/60" aria-hidden />
        </div>

        <h1 className="mt-5 font-serif text-[clamp(1.8rem,4.5vw,2.5rem)] text-balance text-navy">{copy.title}</h1>

        <p className="mt-4 text-[0.98rem] leading-relaxed text-navy-soft">
          {copy.body}{" "}
          <a
            href={`mailto:${CONTACT.email}`}
            className="font-medium text-navy underline decoration-gold/60 underline-offset-4 transition-colors hover:text-gold-dark"
          >
            {CONTACT.email}
          </a>
          .
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {retry && (
            <Button type="button" onClick={() => retry()} className="w-full sm:w-auto">
              <RotateCw className="size-4" aria-hidden />
              {copy.retry}
            </Button>
          )}
          {/* A plain link on purpose: a full load starts the app afresh. */}
          <ButtonLink href="/en" variant="ghost" className="w-full sm:w-auto">
            {copy.home}
          </ButtonLink>
        </div>

        {error.digest && (
          <p className="mt-12 text-[0.72rem] tracking-[0.04em] text-navy-muted">
            {copy.reference} {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
