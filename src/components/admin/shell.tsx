import { FEEDBACK_PRIORITIES, FEEDBACK_PRIORITY_LABELS } from "@/lib/email/feedback";

import { FeedbackButton } from "./feedback-button";
import { AdminSidebar, AdminTopBar } from "./sidebar";

/**
 * The frame every admin page sits in: the navy navigation on the left from
 * `lg` up, a navy top bar below that, and a wide working column on the
 * paper background (the overview and the orders table need the width the
 * client's reading column does not). Server component; the navigation
 * inside is the client island.
 *
 * The Feedback button (fixed, bottom right) rides on every admin page from
 * here; the extra bottom padding keeps the end of a page clear of it.
 */

const FEEDBACK_CHOICES = FEEDBACK_PRIORITIES.map((value) => ({ value, label: FEEDBACK_PRIORITY_LABELS[value] }));

export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-paper lg:flex-row">
      <AdminSidebar email={email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar email={email} />
        <main className="flex-1 px-5 pb-24 pt-10 sm:px-8 lg:px-12 lg:pb-24 lg:pt-12">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
      <FeedbackButton priorities={FEEDBACK_CHOICES} />
    </div>
  );
}
