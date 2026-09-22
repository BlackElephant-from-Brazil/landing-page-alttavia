import type { UserRole } from "@/lib/db/types";

/**
 * What the users screens hand to their client components. Plain data, small
 * on purpose: a server component reads the rows and passes these down, so
 * nothing on these screens fetches a profile from the browser except the
 * counts the delete dialog needs.
 */

export type UserSummary = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: UserRole;
};

/** One line of the service select in the assign dialog, priced on the server. */
export type ServiceChoice = {
  slug: string;
  name: string;
  /** Already formatted, so the client bundle carries no money formatting. */
  price: string;
};
