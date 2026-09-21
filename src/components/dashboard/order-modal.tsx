import { getOrderViewData } from "@/lib/db/client-queries";
import { getUserService } from "@/lib/db/queries";
import type { ServiceRow, ServiceStageRow, UserServiceRow } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";
import { formatEuro } from "@/content/bank-nif";

import { Modal } from "./modal";
import { formatDate, orderStatus } from "./order-status";
import { OrderView, type OrderNotice } from "./order-view";
import { PaymentPill } from "./pills";

/**
 * One order of the account in the centered modal, opened by `?order=<id>`
 * on the dashboard and on the purchases page.
 *
 * Server component: the page hands it the id from its search params and the
 * signed in user, it loads the order through the user client (RLS, plus the
 * user filter in getUserService) and renders the compact order view into the
 * client `<dialog>`. Uploads and the Pay button inside are the same islands
 * the order page uses; they refresh the route, the URL keeps `?order=`, and
 * the modal stays open showing the new state.
 *
 * An id that is not a UUID, does not exist or belongs to another account
 * opens the modal with one line and the close button, so a stale link never
 * leaves the page in a half state, and never says which of the three it was.
 */

const TITLE_ID = "order-modal-title";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const copy = {
  eyebrow: "Your order",
  notFoundTitle: "Order",
  notFound: "This order is not on record.",
  amount: "Amount",
  ordered: "Ordered on",
  stage: "Stage",
  completed: "Completed on",
} as const;

export async function OrderModal({
  orderId,
  userId,
  email,
  notice,
}: {
  orderId: string | undefined;
  userId: string;
  /** The signed in account's address, for the service agreement card. */
  email: string;
  notice?: OrderNotice;
}) {
  if (!orderId) return null;
  if (!UUID.test(orderId)) return <NotFound />;

  const supabase = await createClient();
  const order = await getUserService(supabase, orderId, userId);
  if (!order) return <NotFound />;

  const data = await getOrderViewData(supabase, order);

  return (
    <Modal key={order.id} titleId={TITLE_ID} title={<Header order={order} service={data.service} stages={data.stages} />}>
      <OrderView order={order} {...data} accountEmail={email} notice={notice} compact />
    </Modal>
  );
}

function NotFound() {
  return (
    <Modal
      titleId={TITLE_ID}
      title={
        <h2 id={TITLE_ID} className="font-serif text-xl text-navy">
          {copy.notFoundTitle}
        </h2>
      }
    >
      <p className="text-[0.95rem] text-navy-soft">{copy.notFound}</p>
    </Modal>
  );
}

function Header({ order, service, stages }: { order: UserServiceRow; service: ServiceRow; stages: ServiceStageRow[] }) {
  const name = service.name;
  const status = orderStatus(order);
  const stage = stages.find((s) => s.key === order.stage_key)?.label;

  return (
    <div>
      <p className="text-[0.68rem] font-medium uppercase tracking-[0.28em] text-gold-dark">{copy.eyebrow}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id={TITLE_ID} className="min-w-0 font-serif text-xl leading-snug text-navy">
          {name}
        </h2>
        <PaymentPill order={order} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[0.85rem] sm:grid-cols-3">
        <Fact label={copy.amount} value={formatEuro(order.total_cents)} />
        <Fact label={copy.ordered} value={formatDate(order.created_at)} />
        {status === "completed" && order.completed_at ? (
          <Fact label={copy.completed} value={formatDate(order.completed_at)} />
        ) : stage ? (
          <Fact label={copy.stage} value={stage} />
        ) : null}
      </dl>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-navy-muted">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-navy">{value}</dd>
    </div>
  );
}
