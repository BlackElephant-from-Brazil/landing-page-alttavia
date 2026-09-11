import { Check } from "lucide-react";

import { RichText } from "@/components/bank/rich-text";
import { formatEuro } from "@/content/bank-nif";
import type { ServiceRow } from "@/lib/db/types";

import { BuyButton } from "./buy-button";

/**
 * "Order another service": one card per active service, with name, tagline,
 * price, the first three includes, the timeline and a Buy button. Admin
 * contract section 7. Server component; the button is the client island.
 *
 * No questions here. The gallery is for a client who already knows what
 * they want (a second NIF, the bank account after the NIF). The wizard at
 * /en/apply stays the way in for someone who does not.
 */

const INCLUDES_SHOWN = 3;

export function ServiceGallery({ services }: { services: readonly ServiceRow[] }) {
  return (
    <section aria-labelledby="gallery-heading">
      <h2 id="gallery-heading" className="text-xs uppercase tracking-wider text-navy-muted">
        Order another service
      </h2>
      <p className="mt-3 max-w-prose text-[0.95rem] leading-relaxed text-navy-soft">
        Straight to payment, no questions. The documents we need appear on the order once it is paid.
      </p>

      {services.length === 0 ? (
        <p className="mt-6 rounded-lg border border-navy/10 bg-white px-5 py-4 text-[0.95rem] text-navy-soft shadow-[var(--shadow-soft)]">
          Nothing to order right now.
        </p>
      ) : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2">
          {services.map((service) => (
            <li
              key={service.id}
              className="flex flex-col rounded-lg border border-navy/10 bg-white p-6 shadow-[var(--shadow-soft)]"
            >
              <h3 className="font-serif text-xl leading-snug text-navy">{service.name}</h3>
              {service.tagline && <p className="mt-1.5 text-sm leading-snug text-navy-soft">{service.tagline}</p>}

              <p className="mt-5 font-serif text-4xl leading-none text-navy">{formatEuro(service.price_cents)}</p>
              {service.timeline && <p className="mt-2 text-[0.8rem] text-navy-muted">{service.timeline}</p>}

              {Array.isArray(service.includes) && service.includes.length > 0 && (
                <ul className="mt-5 space-y-2.5">
                  {service.includes.slice(0, INCLUDES_SHOWN).map((feature) => (
                    <li key={feature} className="flex gap-2.5">
                      <Check className="mt-1 size-3.5 shrink-0 text-gold-dark" aria-hidden />
                      <span className="text-[0.88rem] leading-relaxed text-navy-soft">
                        <RichText text={feature} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <BuyButton
                serviceSlug={service.slug}
                priceCents={service.price_cents}
                supportsQuantity={service.supports_quantity}
                className="mt-auto pt-6"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
