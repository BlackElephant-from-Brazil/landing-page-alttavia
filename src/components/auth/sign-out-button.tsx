"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * A quiet text button that ends the session. It is a real form POST to
 * /api/auth/signout, so it works before hydration and with JavaScript off;
 * the route clears the cookies and answers with a 303 to /en, which the
 * browser follows as a full navigation, leaving no stale client cache.
 *
 * Usage (dashboard sidebar or top bar):
 *
 *   <SignOutButton />
 *   <SignOutButton label="Log out" className="text-white/70 hover:text-white" />
 */
export function SignOutButton({
  label = "Sign out",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <form method="post" action="/api/auth/signout" onSubmit={() => setPending(true)} className="inline">
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-2 text-sm font-medium text-navy-soft underline-offset-4 transition-colors duration-200 hover:text-gold-dark hover:underline",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper rounded-sm",
          "disabled:cursor-default disabled:opacity-60 disabled:no-underline",
          className,
        )}
      >
        <LogOut className="size-4" aria-hidden />
        {label}
      </button>
    </form>
  );
}
