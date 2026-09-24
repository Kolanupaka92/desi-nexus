import Link from "next/link";
import styles from "./Header.module.css";
import { Logo } from "./Logo";
import { Shell } from "@/components/ui/Layout";
import { Button, ActionButton } from "@/components/ui/Button";

/**
 * The site header.
 *
 * The menu opens and closes with a checkbox and a label, not with React state.
 * The marketing pages are server components with no other interactivity, so a
 * useState menu would be the only reason any of them ships a client bundle,
 * and it would leave the menu dead between first paint and hydration -- on the
 * connection a visitor opening a WhatsApp link on a phone is actually on, that
 * gap is not short.
 *
 * The input is visually hidden but focusable and the label carries the button
 * role, so the control is reachable by keyboard and announced as a button.
 */
export function Header({ signedIn }: { signedIn: boolean }) {
  return (
    <header className={styles.masthead}>
      <Shell>
        <div className={styles.inner}>
          <Logo />

          <input
            type="checkbox"
            id="nav-toggle"
            className={styles.toggle}
            // Announced as "Menu, collapsed/expanded" rather than "checkbox".
            aria-label="Menu"
          />
          <label htmlFor="nav-toggle" className={styles.toggleButton}>
            <svg
              className={styles.barOpen}
              width="20"
              height="14"
              viewBox="0 0 20 14"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M0 1h20M0 7h20M0 13h20" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            <svg
              className={styles.barClose}
              width="16"
              height="16"
              viewBox="0 0 16 16"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M1 1l14 14M15 1L1 15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </label>

          <nav className={styles.nav} aria-label="Main">
            <Link href="/hire" className={styles.link}>
              Find vendors
            </Link>
            {signedIn ? (
              <>
                <Link href="/gigs" className={styles.link}>
                  Browse gigs
                </Link>
                <Link href="/dashboard" className={styles.link}>
                  Dashboard
                </Link>
                <span className={styles.navCta}>
                  <Button href="/gigs/new" tone="accent" size="small">
                    Post a gig
                  </Button>
                </span>
                <form action="/api/session/logout" method="post" className={styles.navCta}>
                  <ActionButton type="submit" tone="secondary" size="small">
                    Sign out
                  </ActionButton>
                </form>
              </>
            ) : (
              <>
                <Link href="/for-vendors" className={styles.link}>
                  For vendors
                </Link>
                <Link href="/contact" className={styles.link}>
                  Contact
                </Link>
                <Link href="/login" className={styles.link}>
                  Sign in
                </Link>
                <span className={styles.navCta}>
                  <Button href="/gigs/new" tone="accent" size="small">
                    Post a brief
                  </Button>
                </span>
              </>
            )}
          </nav>
        </div>
      </Shell>
    </header>
  );
}
