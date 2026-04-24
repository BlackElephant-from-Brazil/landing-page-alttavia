import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";

const LOCALE_COOKIE = "alttavia_locale";

export default async function RootRedirect() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && isLocale(cookieLocale)) {
    redirect(`/${cookieLocale}`);
  }

  const headerList = await headers();
  const accept = headerList.get("accept-language") ?? "";
  for (const lang of accept
    .toLowerCase()
    .split(",")
    .map((entry) => entry.split(";")[0].trim())) {
    const base = lang.split("-")[0];
    if (isLocale(base)) {
      redirect(`/${base}`);
    }
  }

  redirect(`/${DEFAULT_LOCALE}`);
}
