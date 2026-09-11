"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, type MouseEvent, type SyntheticEvent } from "react";

/**
 * The centered `<dialog>` the order detail opens in. Contract
 * (docs/admin-contract.md) section 2: driven by the URL, so a refresh or a
 * shared link reopens it.
 *
 * The server renders this whenever `?order=` is set and drops it when it is
 * not, so "open" is simply "mounted": `showModal()` runs on mount, which
 * also keeps focus inside natively and wires the Esc key. Closing never touches
 * `dialog.close()` directly; it removes `order` from the URL with
 * `router.replace`, the server renders without the modal, and the element
 * unmounts. Esc arrives as the `cancel` event and is redirected the same
 * way. A click on the backdrop (the dialog element itself, outside the
 * panel) closes too, but only when both the mousedown and the click landed
 * there: a drag that starts inside the panel and ends on the backdrop, as
 * when selecting text, is not a close.
 *
 * The element that had focus when the modal opened (the table row's link,
 * usually) gets it back on unmount, when it is still in the document.
 * `body` scroll is locked while mounted and restored on unmount.
 */
export function Modal({
  title,
  titleId,
  children,
}: {
  title: React.ReactNode;
  titleId: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const pressedOnBackdrop = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const close = useCallback(() => {
    const query = new URLSearchParams(searchParams.toString());
    query.delete("order");
    const string = query.toString();
    router.replace(string ? `${pathname}?${string}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      const previous = opener.current;
      if (previous && previous.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    close();
  }

  function handleBackdropDown(event: MouseEvent<HTMLDialogElement>) {
    pressedOnBackdrop.current = event.target === event.currentTarget;
  }

  function handleBackdrop(event: MouseEvent<HTMLDialogElement>) {
    const pressed = pressedOnBackdrop.current;
    pressedOnBackdrop.current = false;
    if (pressed && event.target === event.currentTarget) close();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onMouseDown={handleBackdropDown}
      onClick={handleBackdrop}
      className="m-auto w-[min(56rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-hidden rounded-lg border border-navy/10 bg-white p-0 text-navy shadow-[var(--shadow-card)] backdrop:bg-navy/50 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-navy/10 px-6 py-5 sm:px-8">
          <div className="min-w-0 flex-1">{title}</div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="-mr-2 -mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-navy-muted transition-colors duration-200 hover:bg-navy/5 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">{children}</div>
      </div>
    </dialog>
  );
}
