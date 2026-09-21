"use client";

import { MessageSquare } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import type { FeedbackPriority } from "@/lib/email/feedback";

import { FeedbackDialog, type Choice } from "./feedback-dialog";

/**
 * The "Feedback" button fixed in the bottom right corner of every admin
 * page (AdminShell renders it once). A click opens FeedbackDialog with the
 * screen prefilled: the path and query of the page as it is at that moment,
 * so an open order modal (`?order=`) is part of it.
 *
 * A dialog that is already open (the order modal) makes the page behind it
 * inert, this button included; the note is then sent after closing it, and
 * the screen field can be edited.
 *
 * On /admin/feedback a saved note refreshes the list behind the dialog.
 */

const FEEDBACK_PATH = "/admin/feedback";
const MAX_PAGE = 500;

function currentScreen(): string {
  const { pathname, search } = window.location;
  return `${pathname}${search}`.slice(0, MAX_PAGE);
}

export function FeedbackButton({ priorities }: { priorities: Choice<FeedbackPriority>[] }) {
  const [screen, setScreen] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        onClick={() => setScreen(currentScreen())}
        aria-haspopup="dialog"
        className="group fixed bottom-5 right-5 z-40 inline-flex h-11 items-center gap-2 rounded-full bg-navy px-4 text-sm font-medium text-white shadow-[var(--shadow-card)] transition-colors duration-200 hover:bg-gold hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper print:hidden sm:bottom-6 sm:right-6"
      >
        <MessageSquare className="size-4 text-gold-light transition-colors duration-200 group-hover:text-navy" aria-hidden />
        Feedback
      </button>
      {screen !== null && (
        <FeedbackDialog
          initialPage={screen}
          priorities={priorities}
          onClose={() => setScreen(null)}
          onSent={() => {
            if (pathname === FEEDBACK_PATH) router.refresh();
          }}
        />
      )}
    </>
  );
}
