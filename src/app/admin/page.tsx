/**
 * PLACEHOLDER. Stage 1 renders a heading so the admin shell is navigable;
 * the admin-ui agent (docs/admin-contract.md section 7, /admin overview) replaces this file.
 * Nothing here is meant to survive that.
 */

import { EyebrowSolo } from "@/components/ui/eyebrow";

export default function OverviewPage() {
  return (
    <div>
      <EyebrowSolo>Alttavia · Admin</EyebrowSolo>
      <h1 className="mt-4 font-serif text-[clamp(1.8rem,4vw,2.5rem)] leading-tight text-navy">Overview</h1>
      <p className="mt-3 max-w-prose text-[0.95rem] leading-relaxed text-navy-soft">This page is being built.</p>
    </div>
  );
}
