import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { isProduction, site } from "@/content/site";
import "./globals.css";

const ibarra = localFont({
  variable: "--font-ibarra",
  display: "swap",
  src: [
    { path: "./fonts/ibarra-real-nova-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibarra-real-nova-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/ibarra-real-nova-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
});

const schibsted = localFont({
  variable: "--font-schibsted",
  display: "swap",
  src: [
    { path: "./fonts/schibsted-grotesk-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/schibsted-grotesk-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/schibsted-grotesk-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "Buks Shot It — Weddings, Portraits, Events, Products",
    template: "%s — Buks Shot It",
  },
  description:
    "Wedding, portrait, event and product photography. Published prices, two sessions a day at most, and online booking.",
  openGraph: { siteName: site.name, type: "website", locale: "en_US" },
  // Preview builds are kept out of search engines until launch.
  robots: isProduction ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#171717",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${ibarra.variable} ${schibsted.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="absolute -left-[9999px] top-2 z-[60] bg-charcoal px-4 py-2 text-ivory focus:left-2">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
