import { redirect } from "next/navigation";

import { PURCHASES_PATH } from "@/components/dashboard/paths";

/**
 * /en/dashboard/orders was the first order gallery. It is now
 * /en/dashboard/purchases (the table) and /en/dashboard/services (the
 * catalogue); old bookmarks land on the table. /en/dashboard/orders/[id]
 * stays a page of its own, because the emails link there.
 */
export default function OrdersPage() {
  redirect(PURCHASES_PATH);
}
