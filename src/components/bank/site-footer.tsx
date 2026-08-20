import { Mail } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";
import { bankNif, CONTACT } from "@/content/bank-nif";
import { brand } from "@/content/brand";

/**
 * lucide dropped the brand marks over trademark concerns, so WhatsApp is an
 * inline path, the same one the main site uses in `ui/whatsapp-float.tsx`.
 */
function WhatsappIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}

/**
 * Section 14.
 *
 * The non affiliation line is both legal protection and a practical Google Ads
 * requirement for this niche: ads that read as an official government service
 * get disapproved. It stays visually bold for that reason.
 *
 * There is deliberately no line here saying the company is run by lawyers.
 * Alttavia Relocation is a relocation firm; the founder's own credential lives
 * in section 6 and nowhere else.
 */
export function SiteFooter() {
  const { footer } = bankNif;

  return (
    <footer className="bg-navy py-10 text-white lg:py-12">
      <Container size="wide">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="max-w-md">
            <Logo tone="cream" className="h-8 w-auto" />
            <p className="mt-5 text-sm leading-relaxed text-white/60">
              {brand.name} · {brand.legalEntity} · {footer.nipc}
              <br />
              {brand.address.street}, {brand.address.zip} Lisboa, Portugal
            </p>

            <ul className="mt-5 space-y-2.5 text-sm">
              <li>
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="inline-flex items-center gap-2.5 text-white/70 transition-colors duration-200 hover:text-gold-light"
                >
                  <Mail className="size-4 shrink-0" aria-hidden />
                  {CONTACT.email}
                </a>
              </li>
              <li>
                <a
                  href={CONTACT.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 text-white/70 transition-colors duration-200 hover:text-gold-light"
                >
                  <WhatsappIcon className="size-4 shrink-0" />
                  {CONTACT.phone}
                  <span className="text-white/35">· Phone and WhatsApp</span>
                </a>
              </li>
            </ul>
          </div>

          <div className="max-w-md lg:text-right">
            <p className="text-sm font-medium leading-relaxed text-white/85">
              {footer.disclaimer}
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm lg:justify-end">
              {footer.links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    {...(link.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="text-white/60 underline-offset-4 transition-colors duration-200 hover:text-gold-light hover:underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-10 border-t border-white/10 pt-6 text-xs text-white/35">
          © {new Date().getFullYear()} {brand.legalEntity}. All rights reserved.
        </p>
      </Container>
    </footer>
  );
}
