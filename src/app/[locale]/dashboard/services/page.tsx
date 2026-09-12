import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LOGIN_PATH, SERVICES_PATH } from "@/components/dashboard/paths";
import { ServiceCards } from "@/components/dashboard/service-cards";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { FALLBACK_SERVICES } from "@/content/apply";
import { getServiceDocsForServices } from "@/lib/db/client-queries";
import { getActiveServices } from "@/lib/db/queries";
import type { ServiceDocRow, ServiceRow } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/user";

export const metadata: Metadata = {
  title: "Services",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ locale: string }> };

const copy = {
  eyebrow: "Client area",
  heading: "Services",
  lead: "Everything you can add to your account, straight to payment. The documents we need appear on the order once it is paid.",
} as const;

/**
 * The catalogue: every active service, three to a row, each card opening
 * the purchase drawer. This page sells: no quantity choice, no warning when
 * the account already holds the same service, because a second NIF or a
 * second account is a second purchase.
 *
 * The rows are read through the user client (RLS: active rows); when that
 * read fails the four services from the code stand in, the way the wizard
 * does, so the page still renders. A purchase on a stand in still goes
 * through /api/orders, which reads the real row. The document labels for
 * each drawer come from service_docs in one query.
 */
export default async function ServicesPage({ params }: Props) {
  const { locale } = await params;
  if (locale !== "en") redirect(SERVICES_PATH);

  const user = await getUser();
  if (!user) redirect(`${LOGIN_PATH}?next=${encodeURIComponent(SERVICES_PATH)}`);

  const supabase = await createClient();
  const services = await getActiveServices(supabase).catch((err: unknown): ServiceRow[] => {
    console.error("services: catalogue unavailable, using the code's copies:", err);
    return [...FALLBACK_SERVICES];
  });
  const docs = await getServiceDocsForServices(
    supabase,
    services.map((s) => s.id),
  ).catch((err: unknown): Map<string, ServiceDocRow[]> => {
    console.error("services: service documents unavailable:", err);
    return new Map();
  });
  const docLabels = Object.fromEntries(services.map((s) => [s.id, (docs.get(s.id) ?? []).map((d) => d.label)]));

  return (
    <div className="space-y-10">
      <header>
        <EyebrowSolo>{copy.eyebrow}</EyebrowSolo>
        <h1 className="mt-4 font-serif text-[clamp(1.8rem,4vw,2.5rem)] leading-tight text-navy">{copy.heading}</h1>
        <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-navy-soft">{copy.lead}</p>
      </header>

      <ServiceCards services={services} docLabels={docLabels} columns={3} />
    </div>
  );
}
