import type { SupabaseClient } from "@supabase/supabase-js";

import type { SlotDoc, SlotUpload } from "@/components/admin/order/required-docs";

/**
 * What the documents rule needs from the database, and nothing else: the
 * service's document slots and the order's upload attempts, with only the
 * columns the rule reads.
 *
 * It sits apart from src/lib/db/queries.ts because it serves one caller,
 * the stage move in src/lib/orders/lifecycle.ts, which must decide whether
 * every required document is approved before it lets the order leave the
 * documents stage. The rule itself lives in
 * src/components/admin/order/required-docs.ts, so the refusal here and the
 * list the firm reads in the modal can never drift apart.
 *
 * Like the other readers, the client comes in as an argument (the admin
 * client here, since a stage move already runs as the service) and database
 * errors are thrown, never swallowed.
 */

export type OrderDocumentState = {
  /** The service's document slots, required ones included. */
  docs: SlotDoc[];
  /** Every upload attempt on the order, any status. */
  documents: SlotUpload[];
};

export async function getOrderDocumentState(
  db: SupabaseClient,
  input: { orderId: string; serviceId: string },
): Promise<OrderDocumentState> {
  const [docsResult, documentsResult] = await Promise.all([
    db.from("service_docs").select("id, required, per_applicant, position").eq("service_id", input.serviceId),
    db
      .from("user_documents")
      .select("service_doc_id, applicant_index, status, created_at")
      .eq("user_service_id", input.orderId),
  ]);

  if (docsResult.error) throw new Error(`service_docs: ${docsResult.error.message}`);
  if (documentsResult.error) throw new Error(`user_documents: ${documentsResult.error.message}`);

  return {
    docs: (docsResult.data ?? []) as SlotDoc[],
    documents: (documentsResult.data ?? []) as SlotUpload[],
  };
}
