import { redirect } from "next/navigation";

import { EmptyState } from "@/components/dashboard/empty-state";
import { OrderView, type OrderNotice } from "@/components/dashboard/order-view";
import { getOrderViewData, getUserServicesForUser } from "@/lib/db/client-queries";
import { getLatestUserService } from "@/lib/db/queries";
import { confirmCheckoutSession } from "@/lib/stripe/confirm";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/user";

const DASHBOARD_PATH = "/en/dashboard";
const LOGIN_PATH = "/en/login";

type Query = {
  checkout?: string | string[];
  session_id?: string | string[];
};

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Query>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function noticeFrom(checkout: string | undefined): OrderNotice | undefined {
  return checkout === "cancelled" || checkout === "unconfirmed" ? checkout : undefined;
}

/**
 * The client's front page: their current order. Platform contract section
 * 9, laid out by OrderView (admin contract section 7).
 *
 * Dynamic by nature: it reads cookies and search params. The Stripe return
 * is handled first and answered with a redirect, so a refresh of the success
 * URL never repeats the confirmation call. Everything else is read through
 * the server client, so row level security is the guard on what one account
 * can see: its own orders, notes, files and the public catalogue.
 *
 * "Current" is what getLatestUserService picks: the newest order that is
 * not complete, a paid one first. An account whose orders are all complete
 * is sent to the orders page from the empty state rather than shown one of
 * them here as if it were still moving.
 */
export default async function DashboardPage({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (locale !== "en") redirect(DASHBOARD_PATH);

  const user = await getUser();
  if (!user) redirect(`${LOGIN_PATH}?next=${encodeURIComponent(DASHBOARD_PATH)}`);

  const sessionId = first(query.session_id);
  if (sessionId) {
    const result = await confirmCheckoutSession(sessionId, user.id);
    redirect(result.ok ? DASHBOARD_PATH : `${DASHBOARD_PATH}?checkout=unconfirmed`);
  }
  const notice = noticeFrom(first(query.checkout));

  const supabase = await createClient();
  const order = await getLatestUserService(supabase, user.id);
  if (!order) {
    const all = await getUserServicesForUser(supabase, user.id);
    return <EmptyState hasCompletedOrders={all.length > 0} />;
  }

  const data = await getOrderViewData(supabase, order);

  return <OrderView order={order} {...data} notice={notice} />;
}
