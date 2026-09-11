import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { RichText } from "@/components/bank/rich-text";
import { formatEuro } from "@/content/bank-nif";
import type { ServiceRow, UserServiceRow } from "@/lib/db/types";

import { BuyButton } from "./buy-button";

/**
 * "Order another service": one card per active service, with name, tagline,
 * price, the first three includes, the timeline and a Buy button. Admin
 * contract section 7. Server component; the button is the client island.
 *
 * No questions here. The gallery is for a client who already knows what
 * they want (a second NIF, the bank account after the NIF). The wizard at
 * /en/apply stays the way in for someone who does not.
 *
 * A service the account already has an open order for (no `completed_at`)
 * shows a link to that order instead of the Buy button, so a second click
 * does not open a second order: "in progress" when paid, "pay it here" when
 * not. Orders are matched to cards by service slug through `orderServices`,
 * the rows behind the account's orders.
 */

const INCLUDES_SHOWN = 3;
const ORDER_PATH = "/en/dashboard/orders";

const copy = {
  inProgress: "You have this one in progress",
  unpaid: "You started this order, pay it here",
} as const;

function openOrderFor(
  service: ServiceRow,
  orders: readonly UserServiceRow[],
  orderServices: ReadonlyMap<string, ServiceRow>,
): UserServiceRow | undefined {
  return orders.find((order) => !order.completed_at && orderServices.get(order.service_id)?.slug === service.slug);
}

export function ServiceGallery({
  services,
  orders = [],
  orderServices = new Map(),
}: {
  services: readonly ServiceRow[];
  /** The account's orders, newest first. */
  orders?: readonly UserServiceRow[];
  /** The service rows behind those orders, keyed by id. */
  orderServices?: ReadonlyMap<string, ServiceRow>;
}) {
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
          {services.map((service) => {
            const open = openOrderFor(service, orders, orderServices);
            return (
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

                {open ? (
                  <p className="mt-auto pt-6">
                    <Link
                      href={`${ORDER_PATH}/${open.id}`}
                      className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-navy underline-offset-4 transition-colors duration-200 hover:text-gold-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      {open.paid_at ? copy.inProgress : copy.unpaid}
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </p>
                ) : (
                  <BuyButton
                    serviceSlug={service.slug}
                    priceCents={service.price_cents}
                    supportsQuantity={service.supports_quantity}
                    className="mt-auto pt-6"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
