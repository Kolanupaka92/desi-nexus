import { taxonomy } from "@/lib/api";
import { label } from "@/lib/format";
import { EVENT_GROUPS, METROS } from "@/content/seo";
import { HOME_FAQ } from "@/content/faq";
import { EnquiryForm } from "@/components/EnquiryForm";
import { Faq } from "@/components/site/Faq";
import { CTASection } from "@/components/site/CTASection";
import { Shell, Band } from "@/components/ui/Layout";
import { Hero } from "@/components/home/Hero";
import { Occasions, Crafts, HowItWorks, Money, SectionHead } from "@/components/home/Sections";

/**
 * The home page.
 *
 * What this replaced was 412 lines of JSX with its layout written inline. The
 * page is now a list of the sections it is made of, and that is the whole
 * intent: reordering the page is an edit to this file and nothing else, and
 * restyling a section is an edit to that section's module which cannot reach
 * anything here.
 *
 * The order answers what a visitor is deciding, in the order they decide it:
 * what am I planning, who do I need, how does this work, how does the money
 * work, what do I still want to ask, and then one action.
 */
export default async function HomePage() {
  // The live taxonomy when the API answers, so a newly seeded occasion shows
  // up without a redeploy -- and the bundled copy when it does not. The call
  // carries a 2.5s timeout (lib/api.ts); without one, Vercel's build sandbox
  // drops packets to an unreachable API rather than refusing them, and the
  // static export times out at 60s. That cost a day once already.
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

  // `code` rather than `slug`: the form posts to the API, which keys metros by
  // code, while the /hire URLs are keyed by slug.
  const metroOptions = METROS.map((metro) => [metro.code, metro.name] as const);

  return (
    <>
      <Hero />
      <Occasions />
      <Crafts />
      <HowItWorks />
      <Money />

      <Band tone="warm" id="enquire" aria-labelledby="enquire-title">
        <Shell narrow>
          <SectionHead
            id="enquire-title"
            kicker="Not ready to post a brief?"
            title="Ask the question first"
            lede="A date and a sentence is enough. No account, no phone verification — we will come back to you."
          />
          <EnquiryForm occasions={occasionOptions} metros={metroOptions} source="/" />
        </Shell>
      </Band>

      <Band id="faq" aria-labelledby="faq-title">
        <Shell narrow>
          <SectionHead id="faq-title" kicker="Questions" title="The things everyone asks" />
          <Faq items={HOME_FAQ} />
        </Shell>
      </Band>

      <Band tone="warm">
        <Shell>
          <CTASection
            eyebrow="One action"
            title="Name the function. We will find the people who have worked it."
            body="A brief takes a few minutes. Matching runs on the occasion, not the category, and the deposit stays in escrow until the work is delivered."
            primary={{ href: "/gigs/new", label: "Post a brief" }}
            secondary={{ href: "/hire", label: "Browse vendors first" }}
          />
        </Shell>
      </Band>
    </>
  );
}
