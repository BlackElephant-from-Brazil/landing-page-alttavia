import { ServiceEditor } from "@/components/admin/services/service-editor";
import { requireAdminPage } from "@/lib/supabase/admin-user";

/**
 * /admin/services/new. Contract (docs/admin-contract.md) section 7. The
 * editor starts from an empty draft with the awaiting_payment stage already
 * in place and POSTs to /api/admin/services.
 */
export default async function NewServicePage() {
  await requireAdminPage();
  return <ServiceEditor />;
}
