"use client";

import { createContext, useContext, type ReactNode } from "react";
import { brand, type Brand } from "@/content/brand";
import { messages, type Messages } from "@/content/messages";
import type { Locale } from "@/lib/i18n";

type ContentValue = {
  locale: Locale;
  brand: Brand;
  t: Messages;
};

const ContentContext = createContext<ContentValue | null>(null);

export function ContentProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value: ContentValue = {
    locale,
    brand,
    t: messages[locale],
  };
  return (
    <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
  );
}

export function useContent(): ContentValue {
  const ctx = useContext(ContentContext);
  if (!ctx) {
    throw new Error("useContent must be used inside a <ContentProvider>.");
  }
  return ctx;
}
