import { cn } from "@/lib/cn";

type EyebrowProps = {
  children: React.ReactNode;
  className?: string;
  /**
   * `centerOnMobile` keeps the eyebrow centered on small screens and
   * left-aligned from `sm` upward. Used for hero-style sections where the
   * desktop layout is split-column but the mobile layout stacks centered.
   */
  align?: "left" | "center" | "centerOnMobile";
};

const ALIGN_CLASSES: Record<NonNullable<EyebrowProps["align"]>, string> = {
  left: "justify-start",
  center: "justify-center",
  centerOnMobile: "justify-center sm:justify-start",
};

export function Eyebrow({ children, className, align = "center" }: EyebrowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 text-[0.72rem] font-medium uppercase tracking-[0.28em] text-rose-gold-dark",
        ALIGN_CLASSES[align],
        className
      )}
    >
      <span className="inline-block h-px w-8 shrink-0 bg-rose-gold/60" aria-hidden />
      <span className="text-center">{children}</span>
      <span className="inline-block h-px w-8 shrink-0 bg-rose-gold/60" aria-hidden />
    </div>
  );
}

export function EyebrowSolo({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-3 text-[0.72rem] font-medium uppercase tracking-[0.28em] text-rose-gold-dark",
        className
      )}
    >
      <span className="inline-block h-px w-8 bg-rose-gold/60" aria-hidden />
      {children}
    </span>
  );
}
