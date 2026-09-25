import { StatusPanel } from "./StatusPanel";
import { Button } from "@/components/ui/Button";

/**
 * What a signed-in page shows when the API cannot be reached at all.
 *
 * Rendered instead of throwing. Before this, /gigs/new, /vendor and /dashboard
 * treated an unreachable API as a crash and returned a 500 -- and /gigs/new is
 * where the "Post a brief" button in the header, on every page of the site,
 * leads.
 *
 * The copy claims only what the code can actually know. It cannot tell "not
 * deployed yet" from "down for a minute", so it promises no timeline, and it
 * offers only exits that genuinely work without the API: the browse pages are
 * static and were verified to render with the API absent.
 */
export function ServiceUnavailable({ title }: { title: string }) {
  return (
    <StatusPanel
      eyebrow="Temporarily unavailable"
      title={title}
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
      <p>
        The booking service isn&rsquo;t reachable at the moment, so anything that needs an
        account &mdash; posting a brief, signing in, managing a profile &mdash; is paused.
      </p>
      <p>
        You can still browse vendors by city and speciality, and see what each occasion needs.
      </p>
    </StatusPanel>
  );
}
