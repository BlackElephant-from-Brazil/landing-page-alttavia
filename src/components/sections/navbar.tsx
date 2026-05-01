"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { LiquidGlassShell } from "@alttavia/liquid-glass";
import { useContent } from "@/components/providers/content-provider";

export function Navbar() {
  const { t, brand } = useContent();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(780px,90vw)]">
      <motion.div
        animate={{
          opacity: scrolled ? 1 : 0.93,
          scale: scrolled ? 1 : 0.992,
        }}
        transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
        style={{ borderRadius: 9999 }}
      >
        <LiquidGlassShell
          lightVariant
          tintOpacity={0.18}
          blur={24}
          filter="glass-distortion-soft"
          borderRadius="9999px"
          className="w-full"
        >
          <nav className="flex h-16 items-center justify-between px-5 sm:px-7 w-full">
            <a href="#top" className="flex items-center gap-2 shrink-0" aria-label={brand.name}>
              <Logo />
            </a>

            <ul className="hidden lg:flex items-center gap-7">
              {t.nav.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="relative text-sm text-navy-soft hover:text-navy transition-colors duration-300 group"
                  >
                    {item.label}
                    <span className="absolute -bottom-1 left-0 h-px w-0 bg-gold transition-all duration-300 group-hover:w-full" />
                  </a>
                </li>
              ))}
            </ul>

            <div className="hidden lg:flex items-center gap-4">
              <LanguageSwitcher />
              <a
                href="#contact"
                className="inline-flex items-center gap-2 px-5 h-10 text-sm font-medium rounded-full bg-navy text-gold hover:text-gold-light transition-colors whitespace-nowrap shrink-0"
              >
                {t.navCtaLabel}
                <ArrowUpRight className="size-3.5" aria-hidden />
              </a>
            </div>

            <div className="lg:hidden flex items-center gap-3">
              <LanguageSwitcher />
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-navy/10 text-navy hover:border-gold/40 transition-colors"
                aria-label={open ? t.closeMenuLabel : t.openMenuLabel}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </div>
          </nav>
        </LiquidGlassShell>
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="mobile-nav"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-2 lg:hidden"
          >
            <LiquidGlassShell
              lightVariant
              tintOpacity={0.80}
              blur={24}
              filter="glass-distortion-soft"
              borderRadius="1.5rem"
              className="w-full"
            >
              <div className="px-5 py-4">
                <ul className="flex flex-col">
                  {t.nav.map((item) => (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="block py-3 text-base text-navy border-b border-navy/10 last:border-b-0 hover:text-gold-dark transition-colors"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                  <li className="pt-5 pb-3">
                    <a
                      href="#contact"
                      onClick={() => setOpen(false)}
                      className="inline-flex items-center gap-2 w-full justify-center h-12 rounded-full bg-navy text-white text-sm font-medium hover:bg-gold hover:text-navy transition-colors"
                    >
                      {t.navCtaLabel}
                      <ArrowUpRight className="size-4" aria-hidden />
                    </a>
                  </li>
                </ul>
              </div>
            </LiquidGlassShell>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
