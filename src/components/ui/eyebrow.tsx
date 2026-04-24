import { cn } from "@/lib/cn";

type EyebrowProps = {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "center";
};

export function Eyebrow({ children, className, align = "center" }: EyebrowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 text-[0.72rem] font-medium uppercase tracking-[0.28em] text-rose-gold-dark",
        align === "center" ? "justify-center" : "justify-start",
        className
      )}
    >
      <span className="inline-block h-px w-8 bg-rose-gold/60" aria-hidden />
      <span>{children}</span>
      <span className="inline-block h-px w-8 bg-rose-gold/60" aria-hidden />
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
