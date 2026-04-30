"use client";

import { motion } from "framer-motion";
import { MapPin, Clock, ArrowUpRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal } from "@/components/ui/reveal";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;

export function Location() {
  const { t, brand } = useContent();
  const location = t.location;

  return (
    <section id="location" className="relative py-24 lg:py-32">
      <Container size="wide" className="relative z-10">
        <div className="grid gap-14 lg:gap-16 lg:grid-cols-12 items-center">
          <div className="lg:col-span-5">
            <Reveal>
              <Eyebrow align="centerOnMobile">{location.eyebrow}</Eyebrow>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="mt-6 font-serif text-balance text-navy">
                {location.title}
              </h2>
            </Reveal>
            <Reveal delay={0.18}>
              <p className="mt-5 text-lg text-navy-soft leading-relaxed">
                {location.desc}
              </p>
            </Reveal>

            <Reveal delay={0.25}>
              <div className="mt-9 space-y-5 border-t border-gold/25 pt-7">
                <div className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white border border-warm-line text-gold-dark">
                    <MapPin className="size-4" strokeWidth={1.5} />
                  </span>
                  <address className="not-italic text-navy leading-relaxed">
                    <div>{brand.address.street}</div>
                    <div>
                      {brand.address.zip} {t.cityLabel}
                    </div>
                    <div>{t.country}</div>
                  </address>
                </div>
                <div className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white border border-warm-line text-gold-dark">
                    <Clock className="size-4" strokeWidth={1.5} />
                  </span>
                  <div className="text-navy leading-relaxed">{t.officeHours}</div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.32}>
              <a
                href={brand.map.link}
                target="_blank"
                rel="noopener"
                className="mt-10 inline-flex items-center gap-2 text-sm text-gold-dark hover:text-navy transition-colors group"
              >
                <span className="border-b border-gold/40 group-hover:border-navy">
                  {location.openMaps}
                </span>
                <ArrowUpRight className="size-4" />
              </a>
            </Reveal>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-8% 0%" }}
            transition={{ duration: 0.9, ease: smooth }}
            className="lg:col-span-7 relative rounded-xl overflow-hidden shadow-[var(--shadow-long)] border border-warm-line/70 bg-white"
          >
            <div className="aspect-[4/3] sm:aspect-[16/10] w-full">
              <iframe
                src={brand.map.embed}
                title="Alttavia Relocation Lisbon office location"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full w-full border-0"
                allowFullScreen
              />
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
