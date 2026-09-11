import Link from "next/link";
import { Plus } from "lucide-react";

import { NEW_SERVICE_PATH } from "@/components/admin/services/paths";
import { ServiceTable } from "@/components/admin/services/service-table";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { listServicesForAdmin } from "@/lib/db/admin-queries";
import { createClient } from "@/lib/supabase/server";

/**
 * /admin/services. Contract (docs/admin-contract.md) section 7.
 *
 * Reads with the user client: the `is_admin()` policies of 0005_admin.sql
 * return every service, inactive ones included, to an admin and nothing to
 * anyone else (the layout has already sent them away). Writes happen on the
 * editor pages through /api/admin/services.
 */

const copy = {
  eyebrow: "Alttavia · Admin",
  title: "Services",
  intro: "What the gallery sells and how each order runs: stages, documents and deliverables.",
  create: "New service",
} as const;

export default async function ServicesPage() {
  const supabase = await createClient();
  const services = await listServicesForAdmin(supabase);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <EyebrowSolo>{copy.eyebrow}</EyebrowSolo>
          <h1 className="mt-4 font-serif text-[clamp(1.8rem,4vw,2.5rem)] leading-tight text-navy">{copy.title}</h1>
          <p className="mt-3 max-w-prose text-[0.95rem] leading-relaxed text-navy-soft">{copy.intro}</p>
        </div>
        <Link
          href={NEW_SERVICE_PATH}
          className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-navy px-6 text-sm font-medium text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-gold hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
        >
          <Plus className="size-4" aria-hidden />
          {copy.create}
        </Link>
      </header>

      <ServiceTable services={services} />
    </div>
  );
}
