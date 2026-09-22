"use client";

import { PackagePlus, UserPlus } from "lucide-react";
import { useState } from "react";

import { outlineActionClass, primaryActionClass } from "../order/use-action";
import { NewUserDialog } from "./account-dialogs";
import { AssignOrderDialog } from "./assign-order-dialog";
import { usersCopy } from "./copy";
import type { ServiceChoice, UserSummary } from "./types";

/**
 * The two buttons that open a dialog from outside the table:
 *
 *   NewUserButton         top right of /admin/users
 *   AssignPurchaseButton  in the user detail modal, next to that person's orders
 *
 * Both are thin: they hold the open state and nothing else, so the page and
 * the modal stay server components.
 */

export function NewUserButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={primaryActionClass}>
        <UserPlus className="size-4" aria-hidden />
        {usersCopy.page.newUser}
      </button>
      {open && <NewUserDialog onClose={() => setOpen(false)} />}
    </>
  );
}

export function AssignPurchaseButton({ user, services }: { user: UserSummary; services: ServiceChoice[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={outlineActionClass}>
        <PackagePlus className="size-4" aria-hidden />
        {usersCopy.actions.assign}
      </button>
      {open && <AssignOrderDialog user={user} services={services} onClose={() => setOpen(false)} />}
    </>
  );
}
