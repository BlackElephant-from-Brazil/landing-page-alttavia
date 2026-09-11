import { notFound } from "next/navigation";

import { ServiceEditor } from "@/components/admin/services/service-editor";
import { getServiceForAdmin } from "@/lib/db/admin-queries";
import { createClient } from "@/lib/supabase/server";

/**
 * /admin/services/[id]. Contract (docs/admin-contract.md) section 7.
 *
 * `params` is a Promise in this Next.js. The id is checked as a UUID before
 * it reaches the database; anything else, and any id the `is_admin()`
 * policies do not return a row for, is a 404. The editor PATCHes
 * /api/admin/services/[id].
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditServicePage({ params }: Props) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const service = await getServiceForAdmin(supabase, id);
  if (!service) notFound();

  return <ServiceEditor key={service.updated_at} initial={service} />;
}
