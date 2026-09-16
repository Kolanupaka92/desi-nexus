# The public site: design system, and what is deliberately missing

This records the decisions behind the marketing surface — the home page, the
occasion pages, the hire pages and the public vendor profile — so the next
person changing them knows which parts are choices and which are constraints.

## 1. What this site is allowed to say

The redesign brief that prompted this work describes a full-service event
planner: *"we'll handle the details"*, *"our team handles the event details"*,
*"Moments We've Helped Create"*, testimonials about us, a lead form that starts
a planning conversation.

DESI-NEXUS is not that. It is a two-sided marketplace: hosts post a brief,
independent vendors apply, a match engine ranks them on cultural fit first, and
an escrow holds the deposit until the work is delivered. The domain model is
`gig.ts`, `matching.ts`, `escrow.ts` and `geo.ts`; there is no planning service
anywhere in it, and nobody on this side of the platform attends an event.

The same brief also says *"only expose services that are actually supported by
the business"* and *"do not invent services merely for SEO"*. Those two
instructions cannot both be satisfied by building the copy literally, so the
site is built for the marketplace that exists. Concretely:

- The primary action is **post a brief**, not "request a consultation".
- Social proof is the **published ranking weights** and the **escrow terms**,
  not testimonials. Both are checkable against the code.
- "Moments we've helped create" has no honest equivalent yet, so there is no
  gallery of past events. There is an **image-slot architecture** ready for one.

### The standing rules

Nothing on the public site may assert:

- a testimonial, review, star rating or quote from a customer
- a count of events served, vendors listed, or hosts matched
- a response or match time ("matched within the hour")
- company history, founding date, team size or awards
- a service the platform does not perform

Two of these were already on the site and have been removed: the home page's
*"Get matched in under an hour"* step, and the speciality page's *"Most briefs
are matched within the hour"*. No booking has settled on this platform, so
there was no source for either. Where a claim was worth keeping, it is restated
as a mechanism — *"ranked on cultural fit first, and every applicant arrives
with the breakdown that produced their score"* — which is true and which a
visitor can verify on the results page.

`PublicVendorProfile.ratingAvg` is optional and absent on every profile today.
The profile page renders nothing where a rating would go, and the
`ProfessionalService` structured data omits `aggregateRating` entirely rather
than defaulting it. When reviews exist, both pick the field up.

## 2. Photography

The repository has no image assets. Not "a few placeholders" — none: no
`<img>`, no `next/image`, no object storage configured in `.env.example`, and
no endpoint that can create a `portfolio_assets` row.

Filling the event-type and speciality cards with stock photography would be a
claim about who works on this platform that is false, and it is also exactly
the interchangeable look the brand is trying to escape. So every card that
wants a photograph has an **image slot** instead: a fixed aspect ratio, a
tinted ground drawn from the palette, and the jaali motif the hero texture uses.
The geometry is decided now, so dropping a real photograph in later changes the
picture and nothing else — no reflow, no re-layout, no second design pass.

What unblocks real photography, in order: object storage provisioned, an upload
endpoint that can write `portfolio_assets`, then `profile_asset_id` moves into
`PUBLISH_REQUIREMENTS` (migration 005 explains why it is deliberately not there
yet), and `next/image` replaces the slot's background.

## 3. Type

Two families, loaded by `next/font` at build time and self-hosted, so there is
no runtime request to a Google domain and no render-blocking stylesheet.

- **Fraunces** for display. Variable, with the `opsz` axis, so the same file
  renders a 64px headline and a 20px section heading correctly rather than
  scaling one set of outlines. Warm rather than icy, which suits the
  marigold-and-wine palette; a Didone would have fought it.
- **Inter** for everything else, deliberately unremarkable. Most of this
  product is forms — a gig brief, a vendor profile, money — and the text face's
  job there is to disappear.

Before this, everything was set in `ui-serif, Georgia`, which resolves to Times
on most Windows machines. A site competing with a wedding photographer's
portfolio cannot be set in Times.

## 4. Tokens

All in `apps/web/app/globals.css`, on `:root`.

| Group | Tokens | Notes |
| --- | --- | --- |
| Type scale | `--step--1` … `--step-5` | Fluid; interpolates between a phone and 1280px. Ratio ≈1.2 at the body end, stretching to ≈1.28 at the display end. |
| Spacing | `--space-1` … `--space-9`, `--band-pad` | 4px base. `--band-pad` is fluid, because 96px above a heading is generous on a desktop and most of a phone screen. |
| Radius | `--radius-sm` … `--radius-xl`, `--radius-pill` | |
| Elevation | `--shadow-sm`, `--shadow-md`, `--shadow-lg` | Two layers each: a tight contact shadow for the edge, a wide soft one for height. One blurred shadow is what makes a card look like a 2014 template. |
| Motion | `--fast`, `--slow`, `--ease` | Zeroed under `prefers-reduced-motion`, which turns off every transition and reveal on the site at once. |
| Layout | `--shell`, `--shell-narrow`, `--measure` | `--measure` caps a paragraph at a readable line length independently of the column it sits in. |

The colour tokens predate this work and are unchanged.

## 5. Components

`apps/web/components/site/`:

- `Header` — the mobile menu is a checkbox and a label, with no JavaScript. The
  marketing pages are otherwise server components with no interactivity, so a
  `useState` menu would be the only reason any of them ship a client bundle,
  and it would be dead between first paint and hydration.
- `Footer` — four columns, every link resolving to a page that exists. It is
  also the internal-linking layer: the long-tail pages are two hops from
  anywhere because of it.
- `SectionHeader` — replaces the eyebrow/heading/lede block that was copied
  inline into each band with an inline `style` to recolour the eyebrow, and was
  wrong at two of the four call sites.
- `Breadcrumbs` — emits the visible trail and the `BreadcrumbList` from one
  list, so the two cannot disagree. As an `<ol>`, because the sequence is the
  meaning; the separator is drawn by `::before` rather than being a chevron
  text node a screen reader reads out as "single right-pointing angle
  quotation mark".
- `Faq` — native `<details>`, so keyboard operation, ARIA semantics and
  open-on-find-in-page come for free. Emits `FAQPage` matching the visible text.
- `CTASection` — one primary action and at most one secondary.
- `JsonLd` — escapes `<`, because vendor-supplied text reaches it on the
  profile pages and a string containing `</script` would close the tag early.

## 6. Structured data

| Type | Where | Notes |
| --- | --- | --- |
| `Organization`, `WebSite` | root layout | Name, URL, area served. No logo, founding date or employee count. |
| `BreadcrumbList` | every nested page | From the `Breadcrumbs` component. |
| `FAQPage` | home | Matches the visible answers exactly. |
| `Service` | speciality pages | The marketplace is the provider, not a local business with a storefront in eight metros. |
| `ProfessionalService` | published vendor profiles | Every field read off the profile. `aggregateRating` omitted while no reviews exist. |

## 7. Routes added

- `/plan/[group]` — five pages, one per occasion group, generated from
  `PLANS` and `EVENT_GROUPS`. The speciality list on each is **computed** from
  `SPECIALITIES[].events`, so the page cannot drift from the match engine's
  own data.

  Five, not forty: crossing the groups with the metros would produce pages
  whose only difference is a place name, which is a doorway set whatever it is
  called. The metro axis already has its own pages, written around what is
  actually different about each metro.

- `/vendors/[slug]` — the public profile. The API gained
  `GET /v1/vendors/:slug` when publishing was added and nothing rendered it, so
  a vendor could opt in to being public and still had no address to send
  anyone. A 404 from the API is a miss; anything else is re-thrown, because a
  soft 404 on a real profile is how a page gets dropped from the index over a
  ten-minute outage.

  Vendor profiles are **not** in the sitemap: they are published one at a time
  by vendors and read at request time, so listing them would mean either a
  build-time query that fails the sitemap when the API is down, or a stale list
  that 404s the moment somebody unpublishes.

## 8. Verification

`apps/web/e2e/screenshots.mjs` renders every public page at 390px and 1280px
and asserts, per page: a 200, a clean console, no horizontal overflow, and
exactly one `h1`. It also opens the mobile menu and checks it starts closed and
becomes visible on tap. Screenshots land in `e2e/shots/`.

This exists because the one regression the unit suite missed last cycle was
caught by opening the app in a browser.
