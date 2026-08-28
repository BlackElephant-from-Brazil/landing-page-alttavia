import type { Metadata } from "next";
import { Spectral, Inter } from "next/font/google";
import { Analytics } from "@/components/analytics";
import "./globals.css";

const spectral = Spectral({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default:
      "Alttavia Relocation. Portuguese NIF and bank accounts, opened remotely.",
    template: "%s · Alttavia Relocation",
  },
  // Proves ownership of this subdomain to Google Search Console, which treats it
  // as a property separate from the main alttavia-relocation.com site.
  verification: { google: "GctatLUPyt0rE4j5_mtzFEGTIKJTFFV-Q_XszLoC7V4" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // `lang` is overridden per-locale inside [locale]/layout.tsx via a wrapper.
  return (
    <html
      lang="en"
      className={`${spectral.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Analytics />
        {children}
      </body>
    </html>
  );
}
