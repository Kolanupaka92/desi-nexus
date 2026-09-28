import type { Metadata } from "next";
import Link from "next/link";
import styles from "./rules.module.css";
import { Band, Shell } from "@/components/ui/Layout";
import { BRAND } from "@/content/brand";
import { RULES_VERSION } from "@/content/rules";

export const metadata: Metadata = {
  title: "Marketplace rules",
  description: `The rules every ${BRAND.name} host and vendor agrees to, starting with the one that matters most: book through ${BRAND.name}.`,
};

/** "2026-09-28" -> "28 September 2026", fixed to UTC so it never shifts a day. */
const UPDATED = new Date(`${RULES_VERSION}T00:00:00Z`).toLocaleDateString("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * The rules every account agrees to at signup.
 *
 * The one that matters most is against taking a client or vendor met here off
 * the platform to avoid it. The penalty is suspension, which is enforced in
 * the API: a suspended account cannot sign in, its profile and listings
 * disappear, and it cannot be booked.
 *
 * Plain language on purpose, because the people agreeing to it are families
 * planning a function and independent vendors, not lawyers. This page states
 * the rule; it is not a substitute for terms of service reviewed by a lawyer,
 * and should be read alongside them once they exist.
 *
 * It claims nothing the platform does not yet do. Online payments are not live,
 * so it does not say escrow protects anyone today, and it states the one
 * exception that follows -- the booked-gig page currently tells people to
 * settle directly, and a rule that punished them for doing so would be a trap.
 *
 * Bump RULES_VERSION in content/rules.ts AND services/api/src/domain/users.ts
 * whenever this changes in substance: accounts record which version they
 * agreed to.
 */
export default function RulesPage() {
  return (
    <Band tone="paper">
      <Shell>
        <article className={styles.page}>
          <p className={styles.eyebrow}>Marketplace rules</p>
          <h1 className={styles.title}>Book through {BRAND.name}</h1>
          <p className={styles.lede}>
            If you meet a host or a vendor through {BRAND.name}, you book them through{" "}
            {BRAND.name}. Every account agrees to this when it is created.
          </p>
          <p className={styles.updated}>Last updated {UPDATED}</p>

          <section className={styles.section} aria-labelledby="the-rule">
            <h2 id="the-rule" className={styles.heading}>
              The rule
            </h2>
            <p>
              Don&rsquo;t take a booking you found here somewhere else to avoid {BRAND.name}. That
              includes:
            </p>
            <ul>
              <li>
                Arranging the booking outside the app with someone you met here &mdash; by phone,
                WhatsApp, email or social media &mdash; to skip the platform.
              </li>
              <li>Swapping contact details before a booking so it can be made off the app.</li>
              <li>Offering or asking for a discount in exchange for booking outside {BRAND.name}.</li>
              <li>
                Asking to be paid privately for a function you were booked for here, once online
                payments are open.
              </li>
            </ul>
            <p>It applies to everyone: hosts and vendors alike.</p>
          </section>

          <section className={styles.section} aria-labelledby="why">
            <h2 id="why" className={styles.heading}>
              Why it matters
            </h2>
            <p>
              A booking made here is recorded here &mdash; the brief, the quote, the price you agreed
              and the conversation around it. That record is what we look at when something goes
              wrong on the day, and it is how reviews stay honest. A booking made elsewhere leaves
              us nothing to help either side with.
            </p>
            <p>
              It is also what keeps {BRAND.name} running. Vendors can find work here, and hosts can
              find vendors who have done their kind of function, because bookings happen here.
            </p>
          </section>

          <aside className={styles.exception} aria-labelledby="for-now">
            <h2 id="for-now" className={styles.heading}>
              For now, before online payments open
            </h2>
            <p>
              Online payments are not live yet. Until they are, paying a vendor directly is{" "}
              <strong>allowed</strong> &mdash; as long as the booking itself is made and kept on{" "}
              {BRAND.name}. Settling payment directly for a booking made here does not break this
              rule. Taking the booking itself elsewhere does.
            </p>
          </aside>

          <section className={styles.section} aria-labelledby="consequence">
            <h2 id="consequence" className={styles.heading}>
              What happens if you break it
            </h2>
            <p>Your account is suspended. That means:</p>
            <ul>
              <li>You can no longer sign in.</li>
              <li>Your profile and listings are removed from {BRAND.name}.</li>
              <li>You can no longer be found in search, or booked.</li>
            </ul>
            <p>
              We record why every account is suspended. If you think we got it wrong,{" "}
              <Link href="/contact">contact us</Link> and we will review it.
            </p>
          </section>

          <section className={styles.section} aria-labelledby="report">
            <h2 id="report" className={styles.heading}>
              If someone asks you to break it
            </h2>
            <p>
              If a host or vendor you met here asks you to book or pay outside {BRAND.name},{" "}
              <Link href="/contact">tell us</Link>. You won&rsquo;t be penalised for reporting it.
            </p>
          </section>
        </article>
      </Shell>
    </Band>
  );
}
