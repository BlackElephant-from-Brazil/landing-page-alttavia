import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { OrderModal } from "@/components/dashboard/order-modal";
import { LOGIN_PATH, PURCHASES_PATH, SERVICES_PATH } from "@/components/dashboard/paths";
import { PurchasesTable } from "@/components/dashboard/purchases-table";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { listOrdersForUser } from "@/lib/db/client-queries";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/user";

export const metadata: Metadata = {
  title: "My purchases",
  robots: { index: false, follow: false },
};

type Query = { order?: string | string[] };

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Query>;
};

const copy = {
  eyebrow: "Client area",
  heading: "My purchases",
  lead: "Every order on this account, newest first. Open one to see where it stands, pay it or send documents.",
  caption: "Purchases",
  emptyTitle: "Nothing bought yet.",
  emptyBody: "Pick a service and go straight to payment. Your order then appears here.",
  emptyCta: "See the services",
} as const;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Every order of the account in one table, newest first, each row opening
 * the order modal through `?order=<id>`. The old /en/dashboard/orders
 * redirects here.
 */
export default async function PurchasesPage({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (locale !== "en") redirect(PURCHASES_PATH);

  const user = await getUser();
  if (!user) redirect(`${LOGIN_PATH}?next=${encodeURIComponent(PURCHASES_PATH)}`);

  const supabase = await createClient();
  const orders = await listOrdersForUser(supabase, user.id);

  return (
    <div className="space-y-10">
      <header>
        <EyebrowSolo>{copy.eyebrow}</EyebrowSolo>
        <h1 className="mt-4 font-serif text-[clamp(1.8rem,4vw,2.5rem)] leading-tight text-navy">{copy.heading}</h1>
        <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-navy-soft">{copy.lead}</p>
      </header>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-navy/10 bg-white px-6 py-8 shadow-[var(--shadow-soft)]">
          <h2 className="font-serif text-xl text-navy">{copy.emptyTitle}</h2>
          <p className="mt-2 max-w-prose text-[0.95rem] leading-relaxed text-navy-soft">{copy.emptyBody}</p>
          <Link
            href={SERVICES_PATH}
            className="mt-5 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-navy underline-offset-4 transition-colors duration-200 hover:text-gold-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            {copy.emptyCta}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      ) : (
        <PurchasesTable items={orders} basePath={PURCHASES_PATH} caption={copy.caption} />
      )}

      <OrderModal orderId={first(query.order)} userId={user.id} email={user.email} />
    </div>
  );
}
