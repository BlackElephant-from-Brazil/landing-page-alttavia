"use client";

import { Marquee } from "@/components/ui/marquee";
import { useContent } from "@/components/providers/content-provider";

function Separator() {
  return (
    <span
      aria-hidden
      className="mx-10 block h-3 w-px shrink-0 bg-gold/40 select-none"
    />
  );
}

function MarqueeItem({ text }: { text: string }) {
  // Stat items ("800+ cases completed", "100% remote", "10+ years of practice"):
  // render leading number/symbol in gold serif italic, descriptor in tracking caps.
  const match = text.match(/^([\d+%]+)\s+(.+)$/);
  if (match) {
    return (
      <span className="flex items-baseline gap-2 whitespace-nowrap">
        <span className="font-serif italic text-gold text-sm leading-none">
          {match[1]}
        </span>
        <span className="text-white/65 text-[10px] uppercase tracking-[0.16em] font-medium">
          {match[2]}
        </span>
      </span>
    );
  }
  return (
    <span className="text-white/70 text-[10px] uppercase tracking-[0.16em] font-medium whitespace-nowrap">
      {text}
    </span>
  );
}

export function HeroMarquee() {
  const { t } = useContent();

  return (
    <div className="relative bg-navy border-t border-gold/25 py-4 overflow-hidden">
      {/* Left fade — items dissolve into navy */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-navy to-transparent"
      />
      {/* Right fade */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-navy to-transparent"
      />

      <Marquee duration="60s" pauseOnHover={false}>
        {t.marquee.items.map((item, i) => (
          <span key={i} className="flex items-center shrink-0">
            <MarqueeItem text={item} />
            <Separator />
          </span>
        ))}
      </Marquee>
    </div>
  );
}
