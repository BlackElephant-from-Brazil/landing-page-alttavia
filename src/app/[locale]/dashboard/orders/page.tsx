import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OrdersTable } from "@/components/dashboard/orders-table";
import { ServiceGallery } from "@/components/dashboard/service-gallery";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { FALLBACK_SERVICES } from "@/content/apply";
import { getServicesByIds, getUserServicesForUser } from "@/lib/db/client-queries";
import { getActiveServices } from "@/lib/db/queries";
import type { ServiceRow } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/user";

export const metadata: Metadata = {
  title: "Your orders",
  robots: { index: false, follow: false },
};

const ORDERS_PATH = "/en/dashboard/orders";
const LOGIN_PATH = "/en/login";

type Props = { params: Promise<{ locale: string }> };

/**
 * The order gallery. Admin contract section 7, "Client /en/dashboard/orders":
 * every order of the account, then one card per active service with a Buy
 * button that goes straight to Stripe.
 *
 * The catalogue is read through the user client (RLS: active rows); when
 * that read fails the four services from the code stand in, the way the
 * wizard does, so the page still renders. A Buy on a stand in still goes
 * through /api/orders, which reads the real row.
 */
export default async function OrdersPage({ params }: Props) {
  const { locale } = await params;
  if (locale !== "en") redirect(ORDERS_PATH);

  const user = await getUser();
  if (!user) redirect(`${LOGIN_PATH}?next=${encodeURIComponent(ORDERS_PATH)}`);

  const supabase = await createClient();
  const [orders, catalogue] = await Promise.all([
    getUserServicesForUser(supabase, user.id),
    getActiveServices(supabase).catch((err: unknown): ServiceRow[] => {
      console.error("orders: services unavailable, using the code's copies:", err);
      return [...FALLBACK_SERVICES];
    }),
  ]);
  const services = await getServicesByIds(
    supabase,
    orders.map((o) => o.service_id),
  ).catch((err: unknown): Map<string, ServiceRow> => {
    console.error("orders: service names unavailable:", err);
    return new Map(catalogue.map((s) => [s.id, s]));
  });

  return (
    <div className="space-y-12">
      <header>
        <EyebrowSolo>Client area</EyebrowSolo>
        <h1 className="mt-4 font-serif text-[clamp(1.8rem,4vw,2.5rem)] leading-tight text-navy">Orders</h1>
        <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-navy-soft">
          Every order on this account, and the services you can add to it.
        </p>
      </header>

      <OrdersTable orders={orders} services={services} />

      <ServiceGallery services={catalogue} orders={orders} orderServices={services} />
    </div>
  );
}
