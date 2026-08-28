"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * False while the server HTML is being hydrated, true afterwards.
 *
 * Use it to hold back anything the server cannot render identically: browser
 * normalised style strings, values read from sessionStorage, decorative layers
 * whose positions come from the client. Reading the store instead of setting
 * state inside an effect keeps the render pass free of cascading updates.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
