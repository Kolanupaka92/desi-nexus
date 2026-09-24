import type { Metadata } from "next";
import { EVENT_GROUPS, METROS } from "@/content/seo";
import { HOME_FAQ } from "@/content/faq";
import { label } from "@/lib/format";
import { taxonomy } from "@/lib/api";
import { EnquiryForm } from "@/components/EnquiryForm";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Faq } from "@/components/site/Faq";

/**
 * A page whose whole job is to be the address somebody can send.
 *
 * The home page carries the same form, and this exists anyway: "contact" is
 * what people type, what they look for in a footer, and what they paste into a
 * message when they forward the site to a cousin. A marketplace with no
 * contact page reads as one that does not want to be contacted.
 *
 * The questions below are the same ones the home page answers, repeated here
 * rather than linked, because somebody on this page is about to ask and half
 * of them are about to ask one of these.
 */
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://desi-nexus.com";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Tell us what you are planning and we will come back with who is available and what the date looks like. No account needed.",
  alternates: { canonical: "/contact" },
};

export const revalidate = 3600;

export default async function ContactPage() {
  // The live taxonomy when the API answers; the bundled copy when it does not,
  // because a contact form whose occasion picker is empty because a service is
  // down is a contact form nobody completes.
  let groups: Record<string, readonly string[]> = EVENT_GROUPS;
  try {
    const data = await taxonomy();
    if (Object.keys(data.eventGroups).length > 0) groups = data.eventGroups;
  } catch {
    // Keeping the bundled copy.
  }

  const occasionOptions = Object.values(groups)
    .flat()
    .map((code) => [code, label(code)] as const);
  const metroOptions = METROS.map((metro) => [metro.code, metro.name] as const);

  return (
    <div className="shell">
      <Breadcrumbs base={SITE} crumbs={[{ label: "Contact" }]} />

      <section style={{ padding: "36px 0 8px", maxWidth: 680 }}>
        <span className="pill">Texas · now booking</span>
        <h1 style={{ marginTop: "var(--space-4)" }}>Tell us what you are planning</h1>
        <p className="lede">
          You do not need an account to ask. Give us the occasion, roughly when and roughly
          where, and we will come back with who is available for it.
        </p>
      </section>

      <div style={{ marginTop: "var(--space-6)", maxWidth: 720 }}>
        <EnquiryForm occasions={occasionOptions} metros={metroOptions} source="/contact" />
      </div>

      <section style={{ marginTop: "var(--space-8)", maxWidth: 760 }}>
        <h2>Before you write</h2>
        <p className="faint" style={{ marginTop: 6 }}>
          Most enquiries are one of these.
        </p>
        <div style={{ marginTop: "var(--space-4)" }}>
          <Faq items={HOME_FAQ} />
        </div>
      </section>
    </div>
  );
}
