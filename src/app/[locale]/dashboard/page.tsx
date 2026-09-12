import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { InProgressSlider } from "@/components/dashboard/in-progress-slider";
import { Notice } from "@/components/dashboard/notice";
import { OrderModal } from "@/components/dashboard/order-modal";
import { isInProgress } from "@/components/dashboard/order-status";
import { DASHBOARD_PATH, LOGIN_PATH, PURCHASES_PATH, SERVICES_PATH } from "@/components/dashboard/paths";
import { PurchasesTable } from "@/components/dashboard/purchases-table";
import { ServiceCards } from "@/components/dashboard/service-cards";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { FALLBACK_SERVICES } from "@/content/apply";
import { getServiceDocsForServices, listOrdersForUser } from "@/lib/db/client-queries";
import { getActiveServices } from "@/lib/db/queries";
import type { ServiceDocRow, ServiceRow } from "@/lib/db/types";
import { confirmCheckoutSession } from "@/lib/stripe/confirm";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/user";

const RECENT_ROWS = 3;
const FEATURED_SERVICES = 3;

type Query = {
  checkout?: string | string[];
  session_id?: string | string[];
  order?: string | string[];
};

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Query>;
};

const copy = {
  eyebrow: "Client area",
  heading: "Welcome back.",
  lead: "Your orders, what we need from you, and what you can add.",
  cancelled: "Payment not completed. Open the order below to try again whenever you are ready.",
  unconfirmed:
    "We could not confirm the payment yet. If you paid, it shows here within a few minutes. Refresh the page to check.",
  purchases: "Your purchases",
  seeAll: "See all",
  addService: "Add a service",
  addServiceLead: "Straight to payment, no questions. The documents we need appear on the order once it is paid.",
  allServices: "See all services",
} as const;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The client's front page. Platform contract section 9 for the Stripe
 * return, then three sections: the "In progress" slider (paid orders not
 * yet complete, plus those completed in the last seven days), the three
 * most recent purchases, and three services to add. An account with no
 * order at all gets the empty state and the service cards.
 *
 * Dynamic by nature: it reads cookies and search params. The Stripe return
 * is handled first and answered with a redirect, so a refresh of the success
 * URL never repeats the confirmation call. Everything else is read through
 * the server client, so row level security is the guard on what one account
 * can see. `?order=<id>` opens the order modal on top of the page.
 */
export default async function DashboardPage({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (locale !== "en") redirect(DASHBOARD_PATH);

  const user = await getUser();
  if (!user) redirect(`${LOGIN_PATH}?next=${encodeURIComponent(DASHBOARD_PATH)}`);

  const sessionId = first(query.session_id);
  if (sessionId) {
    const result = await confirmCheckoutSession(sessionId, user.id);
    redirect(result.ok ? `${DASHBOARD_PATH}?order=${result.userServiceId}` : `${DASHBOARD_PATH}?checkout=unconfirmed`);
  }
  const checkout = first(query.checkout);
  const orderId = first(query.order);

  const supabase = await createClient();
  const [orders, catalogue] = await Promise.all([
    listOrdersForUser(supabase, user.id),
    getActiveServices(supabase).catch((err: unknown): ServiceRow[] => {
      console.error("dashboard: services unavailable, using the code's copies:", err);
      return [...FALLBACK_SERVICES];
    }),
  ]);
  const featured = catalogue.slice(0, FEATURED_SERVICES);
  const docs = await getServiceDocsForServices(
    supabase,
    featured.map((s) => s.id),
  ).catch((err: unknown): Map<string, ServiceDocRow[]> => {
    console.error("dashboard: service documents unavailable:", err);
    return new Map();
  });
  const docLabels = Object.fromEntries(featured.map((s) => [s.id, (docs.get(s.id) ?? []).map((d) => d.label)]));

  const now = new Date();
  const inProgress = orders.filter((item) => isInProgress(item.order, now));
  const recent = orders.slice(0, RECENT_ROWS);

  return (
    <div className="space-y-14">
      {checkout === "cancelled" && <Notice>{copy.cancelled}</Notice>}
      {checkout === "unconfirmed" && <Notice>{copy.unconfirmed}</Notice>}

      {orders.length === 0 ? (
        <EmptyState />
      ) : (
        <header>
          <EyebrowSolo>{copy.eyebrow}</EyebrowSolo>
          <h1 className="mt-4 font-serif text-[clamp(1.8rem,4vw,2.5rem)] leading-tight text-balance text-navy">
            {copy.heading}
          </h1>
          <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-navy-soft">{copy.lead}</p>
        </header>
      )}

      <InProgressSlider items={inProgress} basePath={DASHBOARD_PATH} purchasesHref={PURCHASES_PATH} now={now} />

      {recent.length > 0 && (
        <section aria-labelledby="purchases-heading">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <h2 id="purchases-heading" className="font-serif text-[clamp(1.4rem,2.6vw,1.85rem)] leading-tight text-navy">
              {copy.purchases}
            </h2>
            <SectionLink href={PURCHASES_PATH}>{copy.seeAll}</SectionLink>
          </div>
          <div className="mt-5">
            <PurchasesTable items={recent} basePath={DASHBOARD_PATH} caption={copy.purchases} />
          </div>
        </section>
      )}

      <section aria-labelledby="add-service-heading">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h2 id="add-service-heading" className="font-serif text-[clamp(1.4rem,2.6vw,1.85rem)] leading-tight text-navy">
              {copy.addService}
            </h2>
            <p className="mt-2 max-w-prose text-[0.95rem] leading-relaxed text-navy-soft">{copy.addServiceLead}</p>
          </div>
          <SectionLink href={SERVICES_PATH}>{copy.allServices}</SectionLink>
        </div>
        <div className="mt-6">
          <ServiceCards services={featured} docLabels={docLabels} columns={3} />
        </div>
      </section>

      <OrderModal orderId={orderId} userId={user.id} />
    </div>
  );
}

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-navy-soft underline-offset-4 transition-colors duration-200 hover:text-gold-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
    >
      {children}
      <ArrowRight className="size-4" aria-hidden />
    </Link>
  );
}
