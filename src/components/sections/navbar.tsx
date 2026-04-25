"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { PulseBadge } from "@/components/ui/pulse-badge";
import { Marquee } from "@/components/ui/marquee";
import { useContent } from "@/components/providers/content-provider";
import { cn } from "@/lib/cn";

export function Navbar() {
  const { t, brand } = useContent();
  const status = t.statusBadge;
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
    <>
      {/* Top status strip — only visible at very top. Marquee shows the open-intake label;
          the duplicate "live" text is owned by the in-hero PulseBadge instead. */}
      <div
        className={cn(
          "fixed top-0 inset-x-0 z-[60] bg-navy-deep text-white text-[0.65rem] uppercase tracking-[0.22em] transition-all duration-500 overflow-hidden",
          scrolled ? "max-h-0 opacity-0" : "max-h-10 opacity-100"
        )}
      >
        <div className="flex items-center gap-3 h-9 px-4 sm:px-6">
          <span aria-hidden className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 pulse-dot-green" />
          <div className="flex-1 min-w-0 text-white/65">
            <Marquee
              items={[
                status.label,
                `${brand.address.street}, ${brand.address.zip} Lisboa`,
                status.label,
              ]}
              duration={32}
              edgeFade
              itemClassName="text-[0.65rem] uppercase tracking-[0.22em]"
            />
          </div>
        </div>
      </div>

      <header
        className={cn(
          "fixed inset-x-0 z-50 transition-all duration-500",
          scrolled
            ? "top-0 bg-navy/90 backdrop-blur-xl border-b border-white/10"
            : "top-9 bg-transparent border-b border-transparent"
        )}
      >
        <Container size="wide">
          <nav className="flex h-16 lg:h-18 items-center justify-between">
            <a href="#top" className="flex items-center gap-2" aria-label={brand.name}>
              <Logo tone="cream" />
            </a>

            <ul className="hidden lg:flex items-center gap-7">
              {t.nav.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="relative text-sm text-white/70 hover:text-white transition-colors duration-300 group"
                  >
                    {item.label}
                    <span className="absolute -bottom-1 left-0 h-px w-0 bg-gold transition-all duration-300 group-hover:w-full" />
                  </a>
                </li>
              ))}
            </ul>

            <div className="hidden lg:flex items-center gap-5">
              <LanguageSwitcher tone="cream" />
              <ButtonLink href="#contact" size="md" variant="gold" withArrow>
                {t.navCtaLabel}
              </ButtonLink>
            </div>

            <div className="lg:hidden flex items-center gap-3">
              <LanguageSwitcher tone="cream" />
              <button
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white"
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
              className="lg:hidden border-t border-white/10 bg-navy/95 backdrop-blur-xl"
            >
              <Container size="wide">
                <div className="py-4">
                  <PulseBadge tone="green" className="mb-3 text-[0.6rem]">
                    {status.live}
                  </PulseBadge>
                  <ul className="flex flex-col">
                    {t.nav.map((item) => (
                      <li key={item.href}>
                        <a
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className="block py-3 text-base text-white border-b border-white/10 last:border-b-0"
                        >
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-5">
                    <ButtonLink
                      href="#contact"
                      size="md"
                      variant="gold"
                      withArrow
                      className="w-full"
                      onClick={() => setOpen(false)}
                    >
                      {t.navCtaLabel}
                    </ButtonLink>
                  </div>
                </div>
              </Container>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
