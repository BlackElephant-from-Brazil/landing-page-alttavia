import { redirect } from "next/navigation";

import { AnswersSummary } from "@/components/dashboard/answers-summary";
import { DocumentList } from "@/components/dashboard/documents/document-list";
import { EmptyState } from "@/components/dashboard/empty-state";
import { HelpBox } from "@/components/dashboard/help-box";
import { Notice } from "@/components/dashboard/notice";
import { PayButton } from "@/components/dashboard/pay-button";
import { ServiceCard } from "@/components/dashboard/service-card";
import { StageTimeline } from "@/components/dashboard/stage-timeline";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { formatEuro } from "@/content/bank-nif";
import { summarizeAnswers } from "@/lib/apply/summary";
import {
  getActiveQuestions,
  getLatestUserService,
  getServiceDocs,
  getServiceStages,
  getUserDocuments,
} from "@/lib/db/queries";
import type { QuestionRow, ServiceRow, UserServiceRow } from "@/lib/db/types";
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

const copy = {
  eyebrow: "Your application",
  cancelled: "Payment not completed. You can try again whenever you are ready.",
  unconfirmed:
    "We could not confirm the payment yet. If you paid, it shows here within a few minutes. Refresh the page to check.",
  paymentHeading: "Payment",
  pay: (price: string) => `Pay ${price} and start`,
  payHint:
    "Secure payment through Stripe. You upload your documents right after, on this page, and that is the last thing we need from you.",
  paidTitle: "Payment received",
  paidBody: "Your order is in. Send the documents below and we file it from there.",
  fallbackServiceName: "Your order",
} as const;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The client's one page. Contract section 9.
 *
 * Dynamic by nature: it reads cookies and search params. The Stripe return
 * is handled first and answered with a redirect, so a refresh of the success
 * URL never repeats the confirmation call. Everything else is read through
 * the server client, so row level security is the guard on what one account
 * can see: its own orders, documents and the public catalogue.
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
  const checkout = first(query.checkout);

  const supabase = await createClient();
  const order = await getLatestUserService(supabase, user.id);
  if (!order) return <EmptyState />;

  const [serviceResult, stages, docs, uploaded, questions] = await Promise.all([
    supabase.from("services").select("*").eq("id", order.service_id).maybeSingle(),
    getServiceStages(supabase, order.service_id),
    getServiceDocs(supabase, order.service_id),
    getUserDocuments(supabase, order.id),
    getActiveQuestions(supabase).catch((err: unknown): QuestionRow[] | undefined => {
      console.error("dashboard: questions unavailable, using the copy's labels:", err);
      return undefined;
    }),
  ]);
  if (serviceResult.error) {
    throw new Error(`dashboard: service ${order.service_id}: ${serviceResult.error.message}`);
  }
  const service = (serviceResult.data as ServiceRow | null) ?? fallbackService(order);

  const paid = order.paid_at !== null;
  const price = formatEuro(order.total_cents);
  const answers = summarizeAnswers(order.answers_snapshot ?? {}, questions);

  return (
    <div className="space-y-12">
      {!paid && checkout === "cancelled" && <Notice>{copy.cancelled}</Notice>}
      {!paid && checkout === "unconfirmed" && <Notice>{copy.unconfirmed}</Notice>}

      <header>
        <EyebrowSolo>{copy.eyebrow}</EyebrowSolo>
        <h1 className="mt-4 font-serif text-[clamp(1.8rem,4vw,2.5rem)] leading-tight text-balance text-navy">
          {service.name}
        </h1>
      </header>

      <ServiceCard order={order} service={service} />

      <StageTimeline stages={stages} currentKey={order.stage_key} />

      {paid ? (
        <>
          <Notice tone="success" title={copy.paidTitle}>
            {copy.paidBody}
          </Notice>
          <DocumentList order={order} docs={docs} uploaded={uploaded} />
        </>
      ) : (
        <section aria-labelledby="payment-heading">
          <h2 id="payment-heading" className="text-xs uppercase tracking-wider text-navy-muted">
            {copy.paymentHeading}
          </h2>
          <PayButton userServiceId={order.id} label={copy.pay(price)} className="mt-4" />
          <p className="mt-3 max-w-prose text-[0.85rem] leading-relaxed text-navy-muted">{copy.payHint}</p>
        </section>
      )}

      <AnswersSummary items={answers} />

      <HelpBox />
    </div>
  );
}

/**
 * A service row the catalogue no longer shows (deactivated after the order
 * was placed, so RLS hides it). The order still renders, with its own total
 * and a neutral name, rather than failing the whole page.
 */
function fallbackService(order: UserServiceRow): ServiceRow {
  return {
    id: order.service_id,
    slug: "",
    name: copy.fallbackServiceName,
    tagline: null,
    description: null,
    price_cents: order.total_cents,
    currency: order.currency,
    includes: [],
    timeline: null,
    supports_quantity: false,
    stripe_price_id_test: null,
    stripe_price_id_live: null,
    stripe_payment_link_test: null,
    stripe_payment_link_live: null,
    position: 0,
    active: false,
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}
