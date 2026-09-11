import { ServiceEditor } from "@/components/admin/services/service-editor";

/**
 * /admin/services/new. Contract (docs/admin-contract.md) section 7. The
 * editor starts from an empty draft with the awaiting_payment stage already
 * in place and POSTs to /api/admin/services.
 */
export default function NewServicePage() {
  return <ServiceEditor />;
}
