import Link from "next/link";
import styles from "./Footer.module.css";
import { Logo } from "./Logo";
import { Shell } from "@/components/ui/Layout";
import { METROS, SPECIALITIES } from "@/content/seo";

/**
 * The footer.
 *
 * Every link here resolves to a page that exists: the metro columns are the
 * eight `/hire/[metro]` routes and the speciality column is six of the
 * seventeen `/hire/[metro]/[speciality]` routes, all of them statically
 * generated from the same content module the pages render from. Nothing is
 * invented to fill a column -- a footer carrying "Careers", "Press" and "Blog"
 * links that 404 is both the clearest tell that a site is a template and a
 * crawl budget spent on nothing.
 *
 * It is also the site's internal-linking layer. These pages are the long tail
 * that has to rank, and a link from every page is the cheapest way to make sure
 * each one is reachable in two hops from anywhere.
 */
const FOOTER_SPECIALITIES = [
  "makeup-artist",
  "photographer",
  "henna-artist",
  "pandit",
  "decorator",
  "dj",
];

export function Footer() {
  const specialities = FOOTER_SPECIALITIES.flatMap((slug) =>
    SPECIALITIES.filter((s) => s.slug === slug),
  );

  return (
    <footer className={styles.foot}>
      <Shell>
        <div className={styles.grid}>
          <div className={styles.brandCol}>
            <Logo reversed />
            <p>
              Makeup artists, photographers, henna artists, pandits, decorators and creators for
              South Asian events in Texas, North Carolina and California — matched on the functions they
              worked, and paid through escrow.
            </p>
          </div>

          <div>
            <h3 className={styles.heading}>Where</h3>
            <ul className={styles.list}>
              {METROS.map((metro) => (
                <li key={metro.slug}>
                  <Link href={`/hire/${metro.slug}`}>{metro.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className={styles.heading}>Who</h3>
            <ul className={styles.list}>
              {specialities.map((speciality) => (
                <li key={speciality.slug}>
                  <Link
                    href={`/hire/dallas-fort-worth/${speciality.slug}`}
                    style={{ textTransform: "capitalize" }}
                  >
                    {speciality.noun}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/hire">All {SPECIALITIES.length} specialities</Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className={styles.heading}>Platform</h3>
            <ul className={styles.list}>
              <li>
                <Link href="/gigs/new">Post a brief</Link>
              </li>
              <li>
                <Link href="/for-vendors">Work as a vendor</Link>
              </li>
              <li>
                <Link href="/#how-it-works">How it works</Link>
              </li>
              <li>
                <Link href="/#faq">Questions</Link>
              </li>
              <li>
                <Link href="/contact">Contact us</Link>
              </li>
              <li>
                <Link href="/login">Sign in</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className={styles.base}>
          {/*
            Derived from METROS, not typed out. The hard-coded version listed
            the Rio Grande Valley, El Paso, Corpus Christi and Lubbock on every
            page of the site for as long as it took someone to notice they were
            no longer served -- and nothing would have noticed.
          */}
          <p>Serving {METROS.map((metro) => metro.name).join(", ")}.</p>
          <p>Deposits are held in escrow and released after the event.</p>
        </div>
      </Shell>
    </footer>
  );
}
