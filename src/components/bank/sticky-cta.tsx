"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { bankNif } from "@/content/bank-nif";
import { cn } from "@/lib/cn";

/**
 * Section 13 note: on mobile the buy button is pinned to the bottom of the
 * screen. It appears once the hero has scrolled past, so it never competes with
 * the hero's own button, and it hides again over the final CTA for the same
 * reason.
 */
export function StickyCta() {
  const { sticky } = bankNif;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      const past = window.scrollY > 420;
      const finalCta = document.getElementById("start");
      const atFinalCta = finalCta
        ? finalCta.getBoundingClientRect().top < window.innerHeight - 80
        : false;
      setVisible(past && !atFinalCta);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-navy/10 bg-white/95 backdrop-blur-xl transition-transform duration-300 ease-out lg:hidden",
        visible ? "translate-y-0" : "translate-y-full"
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-hidden={!visible}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          {/* Tight tracking: the full hint has to survive a 375px viewport. */}
          <p className="truncate text-[0.62rem] uppercase tracking-[0.06em] text-navy-muted">
            {sticky.hint}
          </p>
          <p className="font-serif text-xl leading-tight text-navy">
            {sticky.price}
          </p>
        </div>
        <a
          href={sticky.href}
          tabIndex={visible ? undefined : -1}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-navy px-5 text-[0.82rem] font-medium text-white transition-colors duration-200 active:bg-gold active:text-navy"
        >
          {sticky.cta}
          <ArrowUpRight className="size-4" aria-hidden />
        </a>
      </div>
    </div>
  );
}
