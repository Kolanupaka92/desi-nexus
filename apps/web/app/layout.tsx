import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "@/lib/api";
import { BRAND } from "@/content/brand";
import { display, text } from "@/lib/fonts";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { JsonLd } from "@/components/site/JsonLd";
import "./globals.css";

/**
 * Absolute base for canonicals and Open Graph URLs.
 *
 * Without it Next emits `<link rel="canonical" href="/hire/...">`. Relative
 * canonicals are legal and a bad idea: they resolve against whatever host
 * served the page, so a preview deployment or an apex/www mismatch quietly
 * declares itself canonical and splits the ranking it was meant to consolidate.
 */
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://desi-nexus.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description:
    "Book verified makeup artists, photographers, henna artists, pandits and creators for South Asian events across Dallas-Fort Worth, Houston, Austin and San Antonio.",
  openGraph: {
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description:
      "Verified crew and creators for Sangeets, Half-Saree Functions, Griha Pravesham, boutique shoots and more.",
    type: "website",
    siteName: BRAND.name,
  },
  twitter: { card: "summary_large_image" },
  // The browser tab colour, matched to the hero rather than left white, so a
  // phone's address bar joins the page instead of sitting on top of it.
  other: { "theme-color": "#26040f" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const signedIn = Boolean((await cookies()).get(ACCESS_COOKIE)?.value);

  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <body>
        {/*
          Organization and WebSite, once, at the root.
          Deliberately thin: name, URL and the area served, all of which are
          true. No aggregateRating, no founding date, no employee count, no
          logo we do not have -- structured data asserting things the business
          cannot back is a manual action waiting to happen, and the fields
          below are the ones that actually do anything in a knowledge panel.
        */}
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "@id": `${SITE}/#organization`,
                name: BRAND.name,
                url: SITE,
                description:
                  "A marketplace connecting South Asian event hosts in Texas with the crew and creators who work their events.",
                areaServed: {
                  "@type": "State",
                  name: "Texas",
                },
              },
              {
                "@type": "WebSite",
                "@id": `${SITE}/#website`,
                url: SITE,
                name: BRAND.name,
                publisher: { "@id": `${SITE}/#organization` },
                inLanguage: "en-US",
              },
            ],
          }}
        />

        <a href="#content" className="skip">
          Skip to content
        </a>

        <Header signedIn={signedIn} />

        {/*
          tabIndex -1 so the skip link can move focus here, not merely scroll
          to it -- without it the link jumps the viewport and leaves the next
          Tab back in the header, which is the failure mode that makes people
          assume skip links do not work.
        */}
        <main id="content" tabIndex={-1} className="shell">
          {children}
        </main>

        <Footer />
      </body>
    </html>
  );
}
