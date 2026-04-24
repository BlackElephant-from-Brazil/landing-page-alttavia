"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useContent } from "@/components/providers/content-provider";
import { cn } from "@/lib/cn";

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
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-500",
        scrolled
          ? "bg-white/85 backdrop-blur-xl border-b border-warm-line/60"
          : "bg-transparent border-b border-transparent"
      )}
    >
      <Container size="wide">
        <nav className="flex h-20 items-center justify-between">
          <a href="#top" className="flex items-center gap-2" aria-label={brand.name}>
            <Logo />
          </a>

          <ul className="hidden lg:flex items-center gap-8">
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

          <div className="hidden lg:flex items-center gap-5">
            <LanguageSwitcher />
            <ButtonLink href="#contact" size="md" withArrow>
              {t.navCtaLabel}
            </ButtonLink>
          </div>

          <div className="lg:hidden flex items-center gap-3">
            <LanguageSwitcher />
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-navy/10 text-navy"
              aria-label={open ? t.closeMenuLabel : t.openMenuLabel}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </nav>
      </Container>

      <AnimatePresence>
        {open && (
          <motion.div
            key="mobile-nav"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="lg:hidden border-t border-warm-line/60 bg-white/95 backdrop-blur-xl"
          >
            <Container size="wide">
              <ul className="flex flex-col py-4">
                {t.nav.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="block py-3 text-base text-navy border-b border-warm-line/60 last:border-b-0"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
                <li className="pt-5 pb-3">
                  <ButtonLink
                    href="#contact"
                    size="md"
                    withArrow
                    className="w-full"
                    onClick={() => setOpen(false)}
                  >
                    {t.navCtaLabel}
                  </ButtonLink>
                </li>
              </ul>
            </Container>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
