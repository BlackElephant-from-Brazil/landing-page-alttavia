import type { Metadata } from "next";

import { PasswordForm } from "@/components/admin/settings/password-form";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { requireAdminPage } from "@/lib/supabase/admin-user";

export const metadata: Metadata = { title: "Settings" };

/**
 * /admin/settings. Contract (docs/admin-contract.md) section 7: change the
 * password, and a note about two factor authentication, which is not
 * turned on for the Supabase project yet.
 */
export default async function SettingsPage() {
  const admin = await requireAdminPage();
  return (
    <div>
      <EyebrowSolo>Alttavia · Admin</EyebrowSolo>
      <h1 className="mt-4 font-serif text-[clamp(1.8rem,4vw,2.5rem)] leading-tight text-navy">Settings</h1>

      <section aria-labelledby="password-heading" className="mt-10">
        <h2 id="password-heading" className="font-serif text-xl text-navy">
          Change password
        </h2>
        <p className="mt-2 max-w-prose text-[0.95rem] leading-relaxed text-navy-soft">
          You stay signed in on this device after the change. Other devices need the new password next time.
        </p>
        <div className="mt-6">
          <PasswordForm email={admin.email} />
        </div>
      </section>

      <section aria-labelledby="mfa-heading" className="mt-12 max-w-prose">
        <h2 id="mfa-heading" className="font-serif text-xl text-navy">
          Two factor authentication
        </h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-navy-soft">
          Once it is enabled on the project, add a second factor to this account from here. A password alone
          protects every client file on the platform, so a second step is worth the minute it takes.
        </p>
      </section>
    </div>
  );
}
