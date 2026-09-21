"use client";

import type { CSSProperties } from "react";

import ErrorPage from "./error";
import "./globals.css";

/**
 * The last resort: shown when the root layout itself throws, so it replaces
 * that layout and brings its own <html>, <body> and stylesheet. The content
 * is the same calm page as src/app/error.tsx, rendered by that component.
 *
 * The brand fonts are loaded by the root layout through next/font, which is
 * not here. Spectral falls back to Georgia (the default of --font-serif in
 * globals.css); --font-inter is set to the system sans stack so the body text
 * does not drop to the browser's default serif.
 *
 * `metadata` is not supported in this file, hence the React <title>.
 */

type Props = {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
};

const fontFallback = { "--font-inter": "ui-sans-serif, system-ui, -apple-system, sans-serif" } as CSSProperties;

export default function GlobalError({ error, unstable_retry, reset }: Props) {
  return (
    <html lang="en" className="h-full antialiased" style={fontFallback}>
      <body className="flex min-h-full flex-col">
        <title>Something did not load · Alttavia Relocation</title>
        <ErrorPage error={error} unstable_retry={unstable_retry} reset={reset} />
      </body>
    </html>
  );
}
