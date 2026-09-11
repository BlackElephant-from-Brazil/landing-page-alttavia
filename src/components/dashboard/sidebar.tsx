"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, LayoutDashboard } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

/**
 * The client area's navigation, in two shapes: a left column from `lg` up
 * and a top bar below it. Both read the current path so the active entry
 * carries `aria-current="page"`, which is why this file is a client module;
 * everything it renders is still plain links and one sign out form.
 *
 * Two entries only, per the contract: Dashboard and Orders.
 */

export const DASHBOARD_PATH = "/en/dashboard";
export const ORDERS_PATH = "/en/dashboard/orders";

const NAV = [
  { href: DASHBOARD_PATH, label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: ORDERS_PATH, label: "Orders", icon: FolderOpen, exact: false },
] as const;

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ layout }: { layout: "column" | "row" }) {
  const pathname = usePathname();

  return (
    <ul className={cn("flex", layout === "column" ? "flex-col gap-1" : "items-center gap-1")}>
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(pathname, href, exact);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2.5 rounded-full text-sm font-medium transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
                layout === "column" ? "w-full px-4 py-2.5" : "px-3.5 py-2",
                active ? "bg-navy text-white" : "text-navy-soft hover:bg-navy/5 hover:text-navy",
              )}
            >
              <Icon className={cn("size-4 shrink-0", active ? "text-gold-light" : "text-gold-dark")} aria-hidden />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Left column, `lg` and up. */
export function Sidebar({ email }: { email: string }) {
  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-navy/10 bg-white lg:flex" aria-label="Client area">
      <div className="flex h-20 items-center border-b border-navy/10 px-8">
        <Link
          href="/en"
          aria-label="Back to the main page"
          className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
        >
          <Logo className="h-8 w-auto" />
        </Link>
      </div>

      <nav aria-label="Client area pages" className="px-4 py-8">
        <NavLinks layout="column" />
      </nav>

      <div className="mt-auto border-t border-navy/10 px-8 py-6">
        <p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-navy-muted">Signed in as</p>
        <p className="mt-1.5 truncate text-sm text-navy" title={email}>
          {email}
        </p>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}

/** Top bar, below `lg`. */
export function TopBar({ email }: { email: string }) {
  return (
    <header className="border-b border-navy/10 bg-white lg:hidden">
      <div className="flex h-16 items-center justify-between px-5 sm:px-8">
        <Link
          href="/en"
          aria-label="Back to the main page"
          className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
        >
          <Logo className="h-7 w-auto" />
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden max-w-[14rem] truncate text-xs text-navy-muted sm:inline" title={email}>
            {email}
          </span>
          <SignOutButton />
        </div>
      </div>
      <nav aria-label="Client area pages" className="overflow-x-auto px-3 pb-3 sm:px-6">
        <NavLinks layout="row" />
      </nav>
    </header>
  );
}
