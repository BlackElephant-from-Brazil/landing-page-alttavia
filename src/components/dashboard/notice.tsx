import { CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * Two short notices for the top of the dashboard.
 *
 * `quiet` is the tone for things that are fine but worth a line: a checkout
 * closed before paying, a payment the page could not confirm yet. `success`
 * is the "Payment received" banner. Both are `role="status"` so a screen
 * reader hears them without being interrupted.
 */
export function Notice({
  tone = "quiet",
  title,
  children,
}: {
  tone?: "quiet" | "success";
  title?: string;
  children: React.ReactNode;
}) {
  const Icon = tone === "success" ? CheckCircle2 : Info;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-sm border px-4 py-3.5 text-[0.92rem] leading-relaxed",
        tone === "success" ? "border-gold/40 bg-gold/10 text-navy" : "border-navy/10 bg-white text-navy-soft",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-gold-dark" aria-hidden />
      <div>
        {title && <p className="font-serif text-lg leading-tight text-navy">{title}</p>}
        <p className={cn(title && "mt-1")}>{children}</p>
      </div>
    </div>
  );
}
