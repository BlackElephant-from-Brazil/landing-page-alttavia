import { cn } from "@/lib/cn";

type LogoProps = {
  className?: string;
  tone?: "ink" | "cream";
};

export function Logo({ className, tone = "ink" }: LogoProps) {
  const color = tone === "ink" ? "text-ink" : "text-cream";
  return (
    <span
      className={cn(
        "font-serif text-2xl tracking-[-0.02em] lowercase select-none",
        color,
        className
      )}
      aria-label="Alttavia"
    >
      <span className="font-medium">alttavia</span>
      <span className="text-rose-gold italic font-normal">.</span>
    </span>
  );
}
