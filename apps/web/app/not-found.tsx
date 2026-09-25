import type { Metadata } from "next";
import { StatusPanel } from "@/components/site/StatusPanel";
import { Button } from "@/components/ui/Button";
import { METROS, STATE_NAMES } from "@/content/seo";

export const metadata: Metadata = {
  title: "Page not found",
  // A 404 is not content. Next already sends the status; this keeps the
  // page itself out of any index that follows the link regardless.
  robots: { index: false },
};

/*
 * The states served, derived from METROS rather than typed -- the literal
 * "Texas" in the Organization structured data is exactly how this goes stale.
 * Joined as prose: "Texas, North Carolina and California".
 */
const STATES = [...new Set(METROS.map((metro) => STATE_NAMES[metro.state]))];
const STATES_PROSE =
  STATES.length > 1 ? `${STATES.slice(0, -1).join(", ")} and ${STATES.at(-1)}` : (STATES[0] ?? "");

/**
 * The 404, in the site's own voice.
 *
 * Without this file Next rendered its built-in page, which injects
 * `body { background: #fff }` and a 100vh box: the brand's paper ground turned
 * white (black in dark mode) beneath its own header, and the footer was pushed
 * a screen away. It also offered no way back.
 *
 * It matters more than a 404 usually does. Narrowing Texas to four metros
 * retired El Paso, the Rio Grande Valley, Corpus Christi and Lubbock -- each
 * with a page per speciality, all of them in the old sitemap and likely
 * indexed. Those links now land here, so this page says where Utsav does work
 * instead of just that the page is gone.
 */
export default function NotFound() {
  return (
    <StatusPanel
      eyebrow="Page not found"
      title="We couldn’t find that page"
      actions={
        <>
          <Button href="/hire" tone="primary">
            Browse vendors
          </Button>
          <Button href="/" tone="secondary">
            Back to home
          </Button>
        </>
      }
    >
      <p>The link may be out of date, or the page may have moved.</p>
      <p>
        Utsav currently covers {METROS.length} metros across {STATES_PROSE}. If you were looking
        for a city we have stopped serving, the vendor directory shows everywhere we are working
        now.
      </p>
    </StatusPanel>
  );
}
