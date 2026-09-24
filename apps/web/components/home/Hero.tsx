import styles from "./Hero.module.css";
import { Shell } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";

/**
 * The three facts under the headline.
 *
 * Each one is a property of the system that can be checked against the code:
 * the escrow is in services/api/src/payments, the matching weights are in the
 * match engine, and the roster genuinely is closed to vendors by role. None of
 * them is a count of customers, because there are no customers yet and a
 * launch-day marketplace quoting its own popularity is lying.
 */
const PROOF = [
  {
    title: "Paid through escrow",
    body: "The deposit is held until the function is done.",
  },
  {
    title: "Matched on the function",
    body: "Ranked by who has worked your kind of event, not who paid for placement.",
  },
  {
    title: "Identity verified",
    body: "Every vendor who takes money has cleared Stripe Identity.",
  },
];

function Tick() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M2.5 8.5l3.5 3.5 7.5-8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Hero() {
  return (
    <header className={styles.hero}>
      <Shell>
        <p className={styles.eyebrow}>
          <span className={styles.dot} aria-hidden="true" />
          Texas · North Carolina · California
        </p>

        <h1 className={styles.title}>
          The people who <em>already know</em> your function.
        </h1>

        <p className={styles.lede}>
          Makeup artists, photographers, henna artists, pandits, decorators and creators for South
          Asian events across Texas, North Carolina and California — matched on whether they have
          worked your kind of function before.
        </p>

        <div className={styles.actions}>
          <Button href="/gigs/new" tone="accent" size="large">
            Post a brief
          </Button>
          <Button href="/hire" tone="ghostLight" size="large">
            Browse vendors
          </Button>
        </div>

        <ul className={styles.proof}>
          {PROOF.map((item) => (
            <li key={item.title} className={styles.proofItem}>
              <Tick />
              <span>
                <strong>{item.title}</strong>
                {item.body}
              </span>
            </li>
          ))}
        </ul>
      </Shell>
    </header>
  );
}
