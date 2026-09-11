import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/shell";
import { getUser } from "@/lib/supabase/user";

export const metadata: Metadata = {
  title: "Your application",
  robots: { index: false, follow: false },
};

const DASHBOARD_PATH = "/en/dashboard";
const LOGIN_PATH = "/en/login";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * The client area. English only, like /en/apply and /en/login: other locales
 * land on the English route.
 *
 * src/proxy.ts already sends a visitor without a session to the login page
 * before this layout runs; the check here is the belt to that brace, and
 * the one that validates the token with Supabase rather than reading the
 * cookie's own claims. Reading cookies makes everything under this layout
 * dynamic, which is what a page rendering for one person wants.
 */
export default async function DashboardLayout({ children, params }: Props) {
  const { locale } = await params;
  if (locale !== "en") redirect(DASHBOARD_PATH);

  const user = await getUser();
  if (!user) redirect(`${LOGIN_PATH}?next=${encodeURIComponent(DASHBOARD_PATH)}`);

  return <DashboardShell email={user.email}>{children}</DashboardShell>;
}
