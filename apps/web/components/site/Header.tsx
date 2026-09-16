import Link from "next/link";
import { Logo } from "@/components/site/Logo";

/**
 * The site header.
 *
 * The menu opens and closes with a checkbox and a label, not with React state.
 * That is not cleverness for its own sake: the marketing pages are server
 * components with no other interactivity, so a useState menu would be the only
 * reason any of them ships a client bundle, and it would leave the menu dead
 * between first paint and hydration -- on the connection a visitor opening a
 * WhatsApp link on a phone is actually on, that gap is not short.
 *
 * The input is visually hidden but focusable and the label carries the button
 * role, so the control is reachable by keyboard and announced as a button.
 */
export function Header({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="masthead">
      <div className="shell">
        <Logo />

        <input
          type="checkbox"
          id="nav-toggle"
          className="nav-toggle"
          // Announced as "Menu, collapsed/expanded" rather than "checkbox".
          aria-label="Menu"
        />
        <label htmlFor="nav-toggle" className="nav-button">
          <svg className="bar-open" width="20" height="14" viewBox="0 0 20 14" aria-hidden="true" focusable="false">
            <path d="M0 1h20M0 7h20M0 13h20" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          <svg className="bar-close" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M1 1l14 14M15 1L1 15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </label>

        <nav aria-label="Main">
          <Link href="/hire" className="plain">
            Find vendors
          </Link>
          {signedIn ? (
            <>
              <Link href="/gigs" className="plain">
                Browse gigs
              </Link>
              <Link href="/dashboard" className="plain">
                Dashboard
              </Link>
              <Link href="/gigs/new" className="btn small accent">
                Post a gig
              </Link>
              <form action="/api/session/logout" method="post">
                <button type="submit" className="btn small secondary">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/for-vendors" className="plain">
                For vendors
              </Link>
              <Link href="/contact" className="plain">
                Contact
              </Link>
              <Link href="/login" className="plain">
                Sign in
              </Link>
              <Link href="/gigs/new" className="btn small accent">
                Post a brief
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
