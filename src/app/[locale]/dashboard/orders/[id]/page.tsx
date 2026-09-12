import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { OrderView } from "@/components/dashboard/order-view";
import { LOGIN_PATH, ORDERS_PATH, PURCHASES_PATH } from "@/components/dashboard/paths";
import { getOrderViewData } from "@/lib/db/client-queries";
import { getUserService } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/user";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ locale: string; id: string }> };

/**
 * One order of the account, any status, as a full page. The emails the
 * firm sends (a rejected file, a pendency, the order complete) link here,
 * so this route stays even though the dashboard and the purchases page now
 * open the same view in a modal. An id that is not a UUID, does not exist
 * or belongs to another account is a 404 all the same: getUserService
 * filters by the caller and so does RLS, and an order id is not something
 * another account should be able to confirm.
 */
export default async function OrderPage({ params }: Props) {
  const { locale, id } = await params;
  if (locale !== "en") redirect(`${ORDERS_PATH}/${encodeURIComponent(id)}`);
  if (!UUID.test(id)) notFound();

  const user = await getUser();
  if (!user) redirect(`${LOGIN_PATH}?next=${encodeURIComponent(`${ORDERS_PATH}/${id}`)}`);

  const supabase = await createClient();
  const order = await getUserService(supabase, id, user.id);
  if (!order) notFound();

  const data = await getOrderViewData(supabase, order);

  return (
    <div className="max-w-3xl">
      <OrderView order={order} {...data} eyebrow="Your order" backHref={PURCHASES_PATH} />
    </div>
  );
}
