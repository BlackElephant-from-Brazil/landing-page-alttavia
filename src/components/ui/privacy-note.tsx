import { PRIVACY_LINK_TEXT, PRIVACY_PATH } from "@/content/privacy-link";
import { cn } from "@/lib/cn";

/**
 * The link to the privacy notice (/en/privacy) wherever a form collects
 * personal data: the apply wizard's email step, /en/login, the details form
 * of the client area and the line under every Pay button. It opens in a new
 * tab so the form keeps its place. The words live in
 * src/content/privacy-link.ts.
 *
 * No hooks and no "use client": server and client components both render it.
 */

const LINK_CLASS =
  "rounded-sm font-medium text-navy-soft underline decoration-navy/25 underline-offset-4 transition-colors duration-200 hover:text-gold-dark hover:decoration-gold-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2";

export function PrivacyLink({ className }: { className?: string }) {
  return (
    <a href={PRIVACY_PATH} target="_blank" rel="noopener noreferrer" className={cn(LINK_CLASS, className)}>
      {PRIVACY_LINK_TEXT}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** One muted line: what the data is for, then the link. */
export function PrivacyNote({ note, className }: { note?: string; className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-navy-muted", className)}>
      {note ? `${note} ` : null}
      <PrivacyLink />
    </p>
  );
}
