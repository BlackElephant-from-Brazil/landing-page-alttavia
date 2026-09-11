import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { EyebrowSolo } from "@/components/ui/eyebrow";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};

const ORDERS_PATH = "/en/dashboard/orders";
const DASHBOARD_PATH = "/en/dashboard";

type Props = { params: Promise<{ locale: string }> };

/**
 * Placeholder for the order history. Contract section 2: the sidebar has
 * two entries, and this one is under construction. The layout above already
 * checks the session; this page only settles the locale.
 */
export default async function OrdersPage({ params }: Props) {
  const { locale } = await params;
  if (locale !== "en") redirect(ORDERS_PATH);

  return (
    <div>
      <EyebrowSolo>Client area</EyebrowSolo>
      <h1 className="mt-4 font-serif text-[clamp(1.8rem,4vw,2.5rem)] leading-tight text-navy">Orders</h1>
      <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-navy-soft">This page is under construction.</p>
      <Link
        href={DASHBOARD_PATH}
        className="mt-8 inline-flex items-center gap-2 rounded-sm text-sm font-medium text-navy-soft underline-offset-4 transition-colors duration-200 hover:text-gold-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to your application
      </Link>
    </div>
  );
}
