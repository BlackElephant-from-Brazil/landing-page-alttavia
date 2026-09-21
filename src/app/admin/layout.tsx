import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/shell";
import { getUserWithRole } from "@/lib/supabase/admin-user";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

const ADMIN_LOGIN_PATH = "/admin/login";
const CLIENT_DASHBOARD_PATH = "/en/dashboard";

/**
 * The firm's side. Contract (docs/admin-contract.md) section 4.
 *
 * src/proxy.ts already sends a visitor without a session to /admin/login
 * with the path they wanted in `next`; the check here is the one that
 * validates the token with Supabase and reads the role. No user goes to the
 * login page; an admin whose session came from an emailed code goes there
 * too, and the page asks for the password with one line (admin powers need
 * a password session, src/lib/supabase/admin-user.ts); a client goes to
 * their own dashboard. Reading cookies makes everything under this layout
 * dynamic, which is what an admin page wants.
 *
 * The login page is not under this folder (it lives in the
 * `(admin-login)` route group at the same URL prefix), so this guard never
 * runs for it and cannot loop.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserWithRole();
  if (!user || user.needsPassword) redirect(ADMIN_LOGIN_PATH);
  if (user.role !== "admin") redirect(CLIENT_DASHBOARD_PATH);

  return <AdminShell email={user.email}>{children}</AdminShell>;
}
