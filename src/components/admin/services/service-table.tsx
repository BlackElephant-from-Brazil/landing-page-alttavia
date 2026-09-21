import Link from "next/link";
import { Pencil } from "lucide-react";

import { formatEuro } from "@/content/bank-nif";
import { cn } from "@/lib/cn";
import type { ContractTemplate, ServiceWithConfig } from "@/lib/db/types";

import { CONTRACT_TEMPLATE_LABELS } from "./editor-model";
import { servicePath } from "./paths";
import { StatusBadge } from "./service-editor";

/**
 * The services list: one row per service, inactive ones included and
 * greyed, in catalogue position. Server component; the only interaction is
 * the Edit link. The table scrolls inside its own container on narrow
 * screens rather than pushing the page sideways.
 */

const copy = {
  name: "Service",
  slug: "Slug",
  price: "Price",
  status: "Status",
  orders: "Orders",
  stages: "Stages",
  docs: "Documents",
  edit: "Edit",
  empty: "No services yet. Create the first one.",
} as const;

const headClass = "px-4 py-3 text-left text-[0.7rem] font-medium uppercase tracking-[0.16em] text-navy-muted";
const cellClass = "px-4 py-3.5 align-middle text-[0.9rem]";

export function ServiceTable({ services }: { services: ServiceWithConfig[] }) {
  if (services.length === 0) {
    return <p className="rounded-lg border border-navy/10 bg-white p-6 text-[0.95rem] text-navy-soft">{copy.empty}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-navy/10 bg-white shadow-[var(--shadow-soft)]">
      <table className="w-full min-w-[52rem] border-collapse">
        <thead className="border-b border-navy/10 bg-paper">
          <tr>
            <th scope="col" className={headClass}>
              {copy.name}
            </th>
            <th scope="col" className={headClass}>
              {copy.slug}
            </th>
            <th scope="col" className={cn(headClass, "text-right")}>
              {copy.price}
            </th>
            <th scope="col" className={headClass}>
              {copy.status}
            </th>
            <th scope="col" className={cn(headClass, "text-right")}>
              {copy.orders}
            </th>
            <th scope="col" className={cn(headClass, "text-right")}>
              {copy.stages}
            </th>
            <th scope="col" className={cn(headClass, "text-right")}>
              {copy.docs}
            </th>
            <th scope="col" className={headClass}>
              <span className="sr-only">{copy.edit}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => {
            const href = servicePath(service.id);
            return (
              <tr key={service.id} className={cn("border-b border-navy/5 last:border-b-0", !service.active && "text-navy-muted")}>
                <td className={cn(cellClass, "font-medium", service.active ? "text-navy" : "text-navy-muted")}>
                  <Link href={href} className="hover:text-gold-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                    {service.name}
                  </Link>
                  {service.tagline && <span className="mt-0.5 block text-[0.8rem] font-normal text-navy-muted">{service.tagline}</span>}
                  <AgreementHint template={service.contract_template} />
                </td>
                <td className={cn(cellClass, "whitespace-nowrap font-mono text-[0.82rem] text-navy-soft")}>{service.slug}</td>
                <td className={cn(cellClass, "whitespace-nowrap text-right font-serif text-[1.05rem] text-navy")}>
                  {formatEuro(service.price_cents)}
                </td>
                <td className={cellClass}>
                  <StatusBadge active={service.active} />
                </td>
                <td className={cn(cellClass, "text-right tabular-nums")}>{service.orders_count}</td>
                <td className={cn(cellClass, "text-right tabular-nums")}>{service.stages.length}</td>
                <td className={cn(cellClass, "text-right tabular-nums")}>
                  {service.docs.length}
                  <DeedsHint count={service.docs.filter((d) => d.template).length} />
                </td>
                <td className={cn(cellClass, "text-right")}>
                  <Link
                    href={href}
                    aria-label={`${copy.edit} ${service.name}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-navy/15 px-3.5 text-[0.8rem] font-medium text-navy transition-colors hover:border-navy hover:bg-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    {copy.edit}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** "Agreement: NIF" under the name, when the service has a contract the client receives after paying. */
function AgreementHint({ template }: { template: ContractTemplate | null }) {
  if (!template) return null;
  return (
    <span className="mt-0.5 block text-[0.75rem] font-normal text-navy-muted">
      Agreement: {CONTRACT_TEMPLATE_LABELS[template]}
    </span>
  );
}

/** "2 deeds" under the documents count, when some of the slots generate a power of attorney. */
function DeedsHint({ count }: { count: number }) {
  if (count === 0) return null;
  return <span className="block text-[0.75rem] font-normal text-navy-muted">{count === 1 ? "1 deed" : `${count} deeds`}</span>;
}
