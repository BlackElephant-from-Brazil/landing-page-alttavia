"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, FolderOpen, LayoutDashboard, Settings } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

/**
 * The admin area's navigation: a navy left column from `lg` up and a navy
 * top bar below it, the same two shapes as the client dashboard's sidebar,
 * so the firm's side is recognisably the same product and visibly not the
 * client's. Client module for `usePathname` only; everything rendered is
 * plain links and one sign out form.
 *
 * Four entries per the contract: Overview, Orders, Services, Settings.
 */

export const ADMIN_PATH = "/admin";
export const ADMIN_ORDERS_PATH = "/admin/orders";
export const ADMIN_SERVICES_PATH = "/admin/services";
export const ADMIN_SETTINGS_PATH = "/admin/settings";

const EYEBROW = "Alttavia · Admin";

const NAV = [
  { href: ADMIN_PATH, label: "Overview", icon: LayoutDashboard, exact: true },
  { href: ADMIN_ORDERS_PATH, label: "Orders", icon: FolderOpen, exact: false },
  { href: ADMIN_SERVICES_PATH, label: "Services", icon: Briefcase, exact: false },
  { href: ADMIN_SETTINGS_PATH, label: "Settings", icon: Settings, exact: false },
] as const;

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const signOutClass =
  "text-white/70 hover:text-gold-light focus-visible:ring-offset-navy";

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
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-navy",
                layout === "column" ? "w-full px-4 py-2.5" : "px-3.5 py-2",
                active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className={cn("size-4 shrink-0", active ? "text-gold-light" : "text-gold")} aria-hidden />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Eyebrow() {
  return (
    <span className="inline-flex items-center gap-3 text-[0.68rem] font-medium uppercase tracking-[0.28em] text-gold">
      <span className="inline-block h-px w-6 bg-gold/60" aria-hidden />
      {EYEBROW}
    </span>
  );
}

/** Left column, `lg` and up. */
export function AdminSidebar({ email }: { email: string }) {
  return (
    <aside className="hidden w-72 shrink-0 flex-col bg-navy text-white lg:flex" aria-label="Admin area">
      <div className="flex h-20 items-center gap-4 border-b border-white/10 px-8">
        <Link
          href={ADMIN_PATH}
          aria-label="Admin overview"
          className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
        >
          <Logo tone="cream" className="h-8 w-auto" />
        </Link>
      </div>

      <div className="px-8 pt-8">
        <Eyebrow />
      </div>

      <nav aria-label="Admin pages" className="px-4 py-5">
        <NavLinks layout="column" />
      </nav>

      <div className="mt-auto border-t border-white/10 px-8 py-6">
        <p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-white/50">Signed in as</p>
        <p className="mt-1.5 truncate text-sm text-white" title={email}>
          {email}
        </p>
        <div className="mt-4">
          <SignOutButton className={signOutClass} />
        </div>
      </div>
    </aside>
  );
}

/** Top bar, below `lg`. */
export function AdminTopBar({ email }: { email: string }) {
  return (
    <header className="bg-navy text-white lg:hidden">
      <div className="flex h-16 items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-4">
          <Link
            href={ADMIN_PATH}
            aria-label="Admin overview"
            className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
          >
            <Logo tone="cream" className="h-7 w-auto" />
          </Link>
          <span className="hidden sm:inline">
            <Eyebrow />
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden max-w-[14rem] truncate text-xs text-white/60 sm:inline" title={email}>
            {email}
          </span>
          <SignOutButton className={signOutClass} />
        </div>
      </div>
      <nav aria-label="Admin pages" className="overflow-x-auto px-3 pb-3 sm:px-6">
        <NavLinks layout="row" />
      </nav>
    </header>
  );
}
