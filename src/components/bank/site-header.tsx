"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { bankNif, STRIPE_LINKS } from "@/content/bank-nif";
import { cn } from "@/lib/cn";

/**
 * Deliberately thin. This is a single sales page, so the header carries the
 * anchors and one checkout button, and nothing that could pull a reader off
 * the page (no language switcher, no link back to the main site).
 */
export function SiteHeader() {
  const { header } = bankNif;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-all duration-300",
        scrolled
          ? "border-navy/10 bg-white/90 shadow-[var(--shadow-soft)] backdrop-blur-xl"
          : "border-transparent bg-white/70 backdrop-blur-md"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8 lg:h-20 lg:px-12">
        <a href="#top" className="shrink-0" aria-label="Alttavia Relocation">
          <Logo className="h-7 w-auto lg:h-8" />
        </a>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Page sections">
          {header.nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-navy-soft transition-colors duration-200 hover:text-gold-dark"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/*
          The wrapper does the hiding, not a `hidden` class on the button.
          Tailwind sorts display utilities by property, so `hidden` on a
          component that already ships `inline-flex` loses no matter which
          order the classes are written in. Below `sm` the sticky bottom bar
          is the buy button.
        */}
        <span className="hidden sm:block">
          <ButtonLink href={STRIPE_LINKS.bundle} size="md">
            {header.cta}
          </ButtonLink>
        </span>
      </div>
    </header>
  );
}
