"use client";

import { useId, useState, type FormEvent } from "react";

import { cn } from "@/lib/cn";

import { requestJson } from "../lib/request";
import { smallLabelClass, useAction } from "../order/use-action";
import { usersCopy } from "./copy";
import { AdminDialog, DialogForm } from "./dialog";
import type { ServiceChoice, UserSummary } from "./types";

/**
 * "Assign a purchase": an order the firm places for a client, from the
 * users table or from the user's own detail modal.
 *
 * POST /api/admin/users/[id]/orders takes the service and nothing else; the
 * price and the stage come from the service row on the server. The checkbox
 * is for money that arrived another way (a transfer, say): it records the
 * payment at once, moves the order to its next stage and lets the client
 * know by email, the same way a card payment does.
 *
 * On success the dialog closes and the page refreshes, so the new order is
 * in the client's list without a reload.
 */

export function AssignOrderDialog({
  user,
  services,
  onClose,
}: {
  user: UserSummary;
  services: ServiceChoice[];
  onClose: () => void;
}) {
  const id = useId();
  const serviceId = `${id}-service`;
  const paidId = `${id}-paid`;
  const paidHintId = `${id}-paid-hint`;
  const { pending, error, run } = useAction();
  const [serviceSlug, setServiceSlug] = useState(services[0]?.slug ?? "");
  const [paidOutside, setPaidOutside] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !serviceSlug) return;
    const ok = await run(() =>
      requestJson(`/api/admin/users/${user.id}/orders`, {
        method: "POST",
        body: { serviceSlug, paidOutside },
      }),
    );
    if (ok) onClose();
  }

  return (
    <AdminDialog title={usersCopy.assign.title} lead={usersCopy.assign.lead} busy={pending} onClose={onClose}>
      <DialogForm
        onSubmit={submit}
        onCancel={onClose}
        busy={pending}
        error={error}
        submitLabel={usersCopy.assign.submit}
        workingLabel={usersCopy.assign.working}
        cancelLabel={usersCopy.fields.cancel}
        submitDisabled={!serviceSlug}
      >
        <p className="text-[0.9rem] leading-relaxed text-navy-soft">
          For <span className="font-medium text-navy">{user.email}</span>.
        </p>

        <div>
          <label htmlFor={serviceId} className={smallLabelClass}>
            {usersCopy.assign.service}
          </label>
          {services.length === 0 ? (
            <p className="mt-1.5 text-[0.9rem] text-navy-muted">{usersCopy.assign.none}</p>
          ) : (
            <select
              id={serviceId}
              value={serviceSlug}
              onChange={(event) => setServiceSlug(event.target.value)}
              autoFocus
              className={cn(
                "mt-1.5 block h-11 w-full rounded-sm border border-navy/15 bg-white pl-3.5 pr-9 text-[0.9rem] text-navy transition-colors duration-200",
                "hover:border-navy/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {services.map((service) => (
                <option key={service.slug} value={service.slug}>
                  {service.name} ({service.price})
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label htmlFor={paidId} className="flex items-start gap-3">
            <input
              id={paidId}
              type="checkbox"
              checked={paidOutside}
              onChange={(event) => setPaidOutside(event.target.checked)}
              aria-describedby={paidHintId}
              className="mt-0.5 size-4 shrink-0 rounded-sm border-navy/30 accent-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
            />
            <span className="text-[0.9rem] font-medium leading-snug text-navy">{usersCopy.assign.paidOutside}</span>
          </label>
          <p id={paidHintId} className="mt-1.5 pl-7 text-[0.78rem] leading-relaxed text-navy-muted">
            {usersCopy.assign.paidOutsideHint}
          </p>
        </div>
      </DialogForm>
    </AdminDialog>
  );
}
