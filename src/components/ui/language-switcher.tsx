"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";
import { useContent } from "@/components/providers/content-provider";
import { cn } from "@/lib/cn";

const LOCALE_COOKIE = "alttavia_locale";

/**
 * Swaps the locale segment in the URL and sets the preference cookie
 * so the choice survives future visits.
 */
export function LanguageSwitcher({
  className,
  tone = "ink",
}: {
  className?: string;
  tone?: "ink" | "cream";
}) {
  const { locale } = useContent();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  function changeTo(target: Locale) {
    if (target === locale) return;
    // Replace first path segment with the target locale.
    const rest = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "");
    const next = `/${target}${rest || ""}`;
    document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => {
      router.push(next);
      router.refresh();
    });
  }

  const base =
    tone === "cream"
      ? "text-white/70 hover:text-white"
      : "text-navy-soft hover:text-navy";
  const active = tone === "cream" ? "text-gold-light" : "text-navy font-semibold";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {LOCALES.map((loc, i) => (
        <span key={loc} className="inline-flex items-center gap-1">
          {i > 0 && (
            <span
              aria-hidden
              className={cn(
                "text-[0.65rem]",
                tone === "cream" ? "text-white/30" : "text-navy-muted/50"
              )}
            >
              ·
            </span>
          )}
          <button
            type="button"
            onClick={() => changeTo(loc)}
            aria-label={`Switch language to ${LOCALE_LABELS[loc]}`}
            aria-current={locale === loc ? "true" : undefined}
            className={cn(
              "text-xs font-medium uppercase tracking-wider px-1.5 py-1 transition-colors rounded",
              locale === loc ? active : base
            )}
          >
            {LOCALE_LABELS[loc]}
          </button>
        </span>
      ))}
    </div>
  );
}
