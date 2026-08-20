import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentProvider } from "@/components/providers/content-provider";
import { messages } from "@/content/messages";
import { LOCALE_HTML_LANG, isLocale, type Locale } from "@/lib/i18n";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = messages[locale];
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    openGraph: {
      title: t.metaTitle,
      description: t.metaDescription,
      locale: LOCALE_HTML_LANG[locale].replace("-", "_"),
      type: "website",
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const typedLocale: Locale = locale;

  return (
    <div
      lang={LOCALE_HTML_LANG[typedLocale]}
      className="flex flex-1 min-h-full flex-col"
    >
      <ContentProvider locale={typedLocale}>{children}</ContentProvider>
    </div>
  );
}
