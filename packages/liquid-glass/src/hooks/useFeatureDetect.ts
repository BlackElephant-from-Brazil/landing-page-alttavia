"use client";

import { useMemo } from "react";

export type FeatureSupport = {
  /** backdrop-filter: url(#id) -- Chromium 76+ only */
  backdropFilterUrl: boolean;
  /** backdrop-filter: blur() -- Chrome + Safari */
  backdropFilter: boolean;
};

export function useFeatureDetect(): FeatureSupport {
  return useMemo(() => {
    if (typeof CSS === "undefined" || typeof window === "undefined") {
      return { backdropFilterUrl: false, backdropFilter: false };
    }
    return {
      backdropFilterUrl: CSS.supports("backdrop-filter", "url(#x)"),
      backdropFilter:
        CSS.supports("backdrop-filter", "blur(1px)") ||
        CSS.supports("-webkit-backdrop-filter", "blur(1px)"),
    };
  }, []);
}
