export const LOCALES = ["en", "pt", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  pt: "PT",
  es: "ES",
};

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  pt: "Português",
  es: "Español",
};

export const LOCALE_HTML_LANG: Record<Locale, string> = {
  en: "en",
  pt: "pt-BR",
  es: "es",
};
