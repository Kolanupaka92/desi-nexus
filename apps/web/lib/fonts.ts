/**
 * The two typefaces the whole site is set in.
 *
 * Until now everything rendered in `ui-serif, Georgia` and the system sans.
 * That is a real choice on an internal tool and the wrong one here: the system
 * serif resolves to Times on most Windows machines and to a different face on
 * every other platform, so the one element carrying the brand -- the display
 * headline -- looked different to every third visitor and looked like a word
 * processor to a fair number of them. A site whose competition is a wedding
 * photographer's portfolio cannot be set in Times.
 *
 * Fraunces for display. It is a variable face with a real optical-size axis,
 * so the same font file gives a tight, high-contrast headline at 64px and a
 * sturdier one at 24px, rather than the same outlines scaled -- which is the
 * thing that makes most web headlines look slightly wrong at large sizes. It
 * is also warm rather than icy, which matches the marigold-and-wine palette;
 * a Didone would have fought it.
 *
 * Inter for everything else, deliberately unremarkable. Most of this site is
 * forms -- a gig brief, a vendor profile, money -- and the text face's job
 * there is to disappear. Pairing an expressive display serif with a neutral
 * text sans is the boring correct answer; two expressive faces is how a page
 * ends up looking like a template.
 *
 * Both are self-hosted by next/font at build time: no request to a Google
 * domain at runtime, no third-party cookie, no render-blocking stylesheet, and
 * the fallback metrics below are computed by next/font so swapping from the
 * fallback to the real face does not move the layout.
 */
import { Fraunces, Inter } from "next/font/google";

export const display = Fraunces({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  // Variable, and `opsz` is the reason. next/font will not take a fixed weight
  // list alongside an axis -- the axis only exists on the variable file -- so
  // this ships the whole weight range. That is the trade being made knowingly:
  // one larger file that renders correctly at 64px and at 20px, rather than
  // two static cuts that do neither.
  axes: ["opsz"],
  variable: "--font-display",
});

export const text = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-text",
});
