import Image from "next/image";
import { cn } from "@/lib/cn";

type LogoProps = {
  className?: string;
  tone?: "ink" | "cream";
};

/**
 * The brand mark on its own (public/logo-min.svg, 39 x 32), no wordmark.
 * Every header, footer and sidebar renders it through this component, so
 * callers only pick a height (`h-7`, `h-8`) and the width follows.
 * The JSON-LD in src/components/bank/structured-data.tsx keeps the full
 * /logo.svg on purpose: search engines want the wordmark.
 */
export function Logo({ className, tone = "ink" }: LogoProps) {
  return (
    <Image
      src="/logo-min.svg"
      alt="Alttavia"
      width={39}
      height={32}
      className={cn(
        "h-9 w-auto",
        tone === "cream" && "brightness-0 invert",
        className
      )}
      priority
    />
  );
}
