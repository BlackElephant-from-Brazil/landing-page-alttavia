"use client";

import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";
import { useContent } from "@/components/providers/content-provider";

export function Footer() {
  const { t, brand } = useContent();
  const footer = t.footer;

  return (
    <footer className="relative bg-navy-deep text-white pt-20 overflow-hidden has-grain-dark">
      <div aria-hidden className="absolute inset-0 grid-lines-navy opacity-30 pointer-events-none" />

      {/* Big editorial footer wordmark */}
      <div className="relative pt-4 pb-16 lg:pb-20">
        <Container size="wide">
          <div className="grid gap-10 lg:gap-16 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <Logo tone="cream" />
              <p className="mt-5 max-w-md text-sm text-white/65 leading-relaxed">
                {footer.tagline}
              </p>
              <div className="mt-7 flex gap-3">
                <SocialLink href={brand.instagram} label="Instagram">
                  <InstagramIcon className="size-4" />
                </SocialLink>
                <SocialLink href={brand.whatsapp} label="WhatsApp">
                  <WhatsappIcon className="size-4" />
                </SocialLink>
                <SocialLink href={brand.facebook} label="Facebook">
                  <FacebookIcon className="size-4" />
                </SocialLink>
              </div>
            </div>

            <div className="lg:col-span-7 grid gap-10 sm:grid-cols-3">
              {footer.columns.map((col) => (
                <div key={col.title}>
                  <h4 className="text-[0.62rem] uppercase tracking-[0.28em] text-gold-light font-medium">
                    {col.title}
                  </h4>
                  <ul className="mt-5 space-y-3">
                    {col.links.map((link) => (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          className="text-sm text-white/75 hover:text-gold-light transition-colors"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 border-t border-white/10 pt-8">
            <address className="not-italic text-xs text-white/65 leading-relaxed">
              <span className="block uppercase tracking-[0.22em] text-gold-light mb-2">
                {footer.officeLabel}
              </span>
              {brand.address.street}
              <br />
              {brand.address.zip} {t.cityLabel}, {t.country}
            </address>
            <div className="text-xs text-white/65 leading-relaxed sm:text-right">
              <span className="block uppercase tracking-[0.22em] text-gold-light mb-2">
                {footer.getInTouchLabel}
              </span>
              <a
                href={`mailto:${brand.email}`}
                className="hover:text-gold-light transition-colors"
              >
                {brand.email}
              </a>
              <br />
              <a
                href={brand.whatsapp}
                target="_blank"
                rel="noopener"
                className="hover:text-gold-light transition-colors"
              >
                {brand.phone}
              </a>
            </div>
          </div>
        </Container>
      </div>

      <div className="relative border-t border-white/10 py-6">
        <Container size="wide">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
            <p className="text-xs text-white/55">{footer.copyright(new Date().getFullYear())}</p>
            <p className="text-xs text-white/55 font-mono">{t.cityLabel}, {t.country}</p>
          </div>
        </Container>
      </div>
    </footer>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/75 hover:border-gold hover:text-gold-light transition-colors"
    >
      {children}
    </a>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" />
    </svg>
  );
}

function WhatsappIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}
