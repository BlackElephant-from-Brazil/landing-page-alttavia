"use client";

import Link from "next/link";
import { Eye, PackagePlus, Pencil, Trash2, type LucideIcon } from "lucide-react";
import { useState, type MouseEvent } from "react";

import { EditUserDialog } from "./account-dialogs";
import { AssignOrderDialog } from "./assign-order-dialog";
import { usersCopy } from "./copy";
import { DeleteUserDialog } from "./delete-user-dialog";
import type { ServiceChoice, UserSummary } from "./types";

/**
 * The actions on one row of /admin/users: view details, edit, assign a
 * purchase, delete.
 *
 * Each is an icon with a word. The word is hidden until the pointer or the
 * keyboard reaches the control, when it opens beside the icon; the same
 * word is the control's accessible name and its `title`, so it is there for
 * a screen reader, for a slow hover and for a narrow screen alike. Nothing
 * is positioned outside the row, because the table scrolls sideways inside
 * its card and a floating tooltip would be clipped by it.
 *
 * The whole row is a link to the user modal (DataTable lays one over the
 * row), so these sit on their own stacking context above it and swallow the
 * click that opened them. View details is the same link, spelled out.
 *
 * An administrator account shows no controls but the first: its profile is
 * changed only from its own session (/admin/settings), and the routes
 * refuse the rest with 403 anyway.
 */

const iconButtonClass =
  "group inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-navy/15 bg-white px-2.5 text-navy transition-colors duration-200 hover:border-navy hover:bg-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white";

const dangerButtonClass =
  "group inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-clay/30 bg-white px-2.5 text-clay transition-colors duration-200 hover:border-clay hover:bg-clay hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white";

/** The word beside the icon, closed until the control is hovered or focused. */
const labelClass =
  "max-w-0 overflow-hidden whitespace-nowrap text-[0.78rem] font-medium opacity-0 transition-all duration-200 group-hover:max-w-[9rem] group-hover:opacity-100 group-focus-visible:max-w-[9rem] group-focus-visible:opacity-100";

function ActionIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="size-4 shrink-0" aria-hidden />;
}

function IconLink({ href, label, icon }: { href: string; label: string; icon: LucideIcon }) {
  return (
    <Link href={href} scroll={false} title={label} aria-label={label} className={iconButtonClass}>
      <ActionIcon icon={icon} />
      <span aria-hidden className={labelClass}>
        {label}
      </span>
    </Link>
  );
}

function IconButton({
  label,
  icon,
  onClick,
  tone = "default",
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={tone === "danger" ? dangerButtonClass : iconButtonClass}
    >
      <ActionIcon icon={icon} />
      <span aria-hidden className={labelClass}>
        {label}
      </span>
    </button>
  );
}

type OpenDialog = "edit" | "assign" | "remove" | null;

export function UserRowActions({
  user,
  services,
  detailHref,
}: {
  user: UserSummary;
  services: ServiceChoice[];
  /** The users page URL with `?user=<id>` added: the same place the row goes. */
  detailHref: string;
}) {
  const [open, setOpen] = useState<OpenDialog>(null);
  const close = () => setOpen(null);

  // The row's link lies under this cell; a click that opened a dialog must
  // not also follow it.
  function stop(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  return (
    <div className="relative z-10 flex items-center justify-end gap-1" onClick={stop}>
      <IconLink href={detailHref} label={usersCopy.actions.view} icon={Eye} />

      {user.role === "admin" ? (
        <span className="ml-1 text-[0.78rem] text-navy-muted">{usersCopy.page.adminRow}</span>
      ) : (
        <>
          <IconButton label={usersCopy.actions.edit} icon={Pencil} onClick={() => setOpen("edit")} />
          <IconButton label={usersCopy.actions.assign} icon={PackagePlus} onClick={() => setOpen("assign")} />
          <IconButton label={usersCopy.actions.remove} icon={Trash2} tone="danger" onClick={() => setOpen("remove")} />
        </>
      )}

      {open === "edit" && <EditUserDialog user={user} onClose={close} />}
      {open === "assign" && <AssignOrderDialog user={user} services={services} onClose={close} />}
      {open === "remove" && <DeleteUserDialog user={user} onClose={close} />}
    </div>
  );
}
