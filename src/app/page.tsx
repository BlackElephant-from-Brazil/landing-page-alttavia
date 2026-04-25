import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";

const LOCALE_COOKIE = "alttavia_locale";

/**
 * First-time visitors always land in the default locale (English).
 * The visitor's stored preference (set by the language switcher) is
 * the only thing that overrides that default.
 */
export default async function RootRedirect() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && isLocale(cookieLocale)) {
    redirect(`/${cookieLocale}`);
  }
  redirect(`/${DEFAULT_LOCALE}`);
}
