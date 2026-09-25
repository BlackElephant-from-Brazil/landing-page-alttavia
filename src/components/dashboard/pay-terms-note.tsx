import { SERVICE_TERMS_PATH, acceptanceLineParts } from "@/content/terms-version";
import { cn } from "@/lib/cn";

/**
 * The line under every Pay button: "By paying you accept the service terms
 * and your service agreement.", with "service terms" opening
 * /en/service-terms in a new tab so the page with the button stays put.
 * The words live in src/content/terms-version.ts, next to the version the
 * order records when the button is clicked.
 *
 * The click is the acceptance (POST /api/checkout is sent with
 * `acceptTerms: true`), so the button points `aria-describedby` at this
 * line's `id` and a screen reader hears the terms with the button.
 *
 * No hooks and no "use client": the Pay button renders it under itself, and
 * the "In progress" card (a server component) renders it under its button
 * row, where it spans the row instead of the button's width. Small and
 * muted: it informs, it does not compete with the price.
 */

export function PayTermsNote({
  id,
  align = "start",
  className,
}: {
  id?: string;
  /** Which edge the line sits on, matching the button above it. */
  align?: "start" | "center" | "end";
  className?: string;
}) {
  const { before, link, after } = acceptanceLineParts();
  return (
    <p
      id={id}
      className={cn(
        "text-xs leading-relaxed text-navy-muted",
        align === "center" && "text-center",
        align === "end" && "text-right",
        className,
      )}
    >
      {before}
      <a
        href={SERVICE_TERMS_PATH}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-sm font-medium text-navy-soft underline decoration-navy/25 underline-offset-4 transition-colors duration-200 hover:text-gold-dark hover:decoration-gold-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
      >
        {link}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      {after}
    </p>
  );
}
