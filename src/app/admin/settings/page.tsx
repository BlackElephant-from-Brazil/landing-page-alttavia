import type { Metadata } from "next";

import { MfaEnrol } from "@/components/admin/settings/mfa-enrol";
import { mfaCopy, verifiedTotpFactors, type EnrolledFactor } from "@/components/admin/settings/mfa-helpers";
import { PasswordForm } from "@/components/admin/settings/password-form";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { requireAdminPage } from "@/lib/supabase/admin-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

/**
 * The account's verified TOTP factors, read with the admin's own session:
 * listFactors() takes them from the user Supabase Auth validates, never
 * from the cookie alone. Null when that call fails, so the card says it
 * could not check instead of offering a second set up.
 */
async function loadFactors(): Promise<EnrolledFactor[] | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) {
      console.error("admin settings: could not list the second factors:", error?.code ?? "no data");
      return null;
    }
    return verifiedTotpFactors(data.all);
  } catch (error) {
    console.error("admin settings: could not list the second factors:", error instanceof Error ? error.name : "unknown");
    return null;
  }
}

/**
 * /admin/settings. Contract (docs/admin-contract.md) section 7: change the
 * password, and since 2026-09-25 the second factor, a code from an
 * authenticator app (rules in src/lib/supabase/admin-user.ts).
 */
export default async function SettingsPage() {
  const admin = await requireAdminPage();
  const factors = await loadFactors();
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
          {mfaCopy.heading}
        </h2>
        <div className="mt-2">
          {factors === null ? (
            <p className="text-[0.95rem] leading-relaxed text-navy-soft">{mfaCopy.loadFailed}</p>
          ) : (
            <MfaEnrol factors={factors} />
          )}
        </div>
      </section>
    </div>
  );
}
