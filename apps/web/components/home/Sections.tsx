import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Sections.module.css";
import { Shell, Band, Grid } from "@/components/ui/Layout";
import { OccasionTile } from "@/components/occasion/OccasionTile";
import { OCCASIONS } from "@/content/occasions";
import { SPECIALITIES } from "@/content/seo";

/** A section's heading block. One shape, so every band starts the same way. */
export function SectionHead({
  kicker,
  title,
  lede,
  id,
}: {
  kicker: string;
  title: string;
  lede?: string;
  id?: string;
}) {
  return (
    <div className={styles.sectionHead}>
      <span className={styles.kicker}>{kicker}</span>
      <h2 className={styles.sectionTitle} id={id}>
        {title}
      </h2>
      {lede && <p className={styles.sectionLede}>{lede}</p>}
    </div>
  );
}

/**
 * What are you planning?
 *
 * First section after the hero, because it is the first question a visitor is
 * actually answering. The old page led with "how it works", which is what we
 * want to say rather than what they came to find out.
 */
export function Occasions() {
  return (
    <Band aria-labelledby="occasions-title">
      <Shell>
        <SectionHead
          id="occasions-title"
          kicker="Start here"
          title="What are you planning?"
          lede="Every function has its own crew. Pick yours and see the people who have worked it before."
        />
        <Grid size="wide">
          {OCCASIONS.map((occasion, i) => (
            <OccasionTile key={occasion.key} occasion={occasion} feature={i === 0} />
          ))}
        </Grid>
      </Shell>
    </Band>
  );
}

/**
 * The eight crafts.
 *
 * Text chips rather than cards. Above this sit five saturated colour blocks;
 * eight more would turn the page into a quilt and neither row would lead.
 */
export function Crafts() {
  return (
    <Band tone="warm" aria-labelledby="crafts-title">
      <Shell>
        <SectionHead
          id="crafts-title"
          kicker="Who you need"
          title="Book the craft, not a catalogue"
          lede="Every vendor lists the functions they have actually worked. That is what the match runs on."
        />
        <div className={styles.crafts}>
          {SPECIALITIES.map((speciality) => (
            <Link
              key={speciality.slug}
              href={`/hire/dallas-fort-worth/${speciality.slug}`}
              className={styles.craft}
            >
              <span className={styles.craftDot} aria-hidden="true" />
              <span style={{ textTransform: "capitalize" }}>{speciality.noun}</span>
            </Link>
          ))}
        </div>
      </Shell>
    </Band>
  );
}

const STEPS = [
  {
    title: "Describe the function",
    body: "The occasion, the date, the city, the budget. Two minutes, no account needed to start.",
  },
  {
    title: "See who fits",
    body: "Vendors are ranked on whether they have worked your kind of event — not on who paid for placement.",
  },
  {
    title: "Book and pay in escrow",
    body: "The deposit is held until the function is done. Nobody is out of pocket before the work happens.",
  },
];

export function HowItWorks() {
  return (
    <Band id="how-it-works" aria-labelledby="how-title">
      <Shell>
        <SectionHead id="how-title" kicker="How it works" title="Three steps, and no cold calls" />
        <div className={styles.steps}>
          {STEPS.map((step) => (
            <div key={step.title} className={styles.step}>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepBody}>{step.body}</p>
            </div>
          ))}
        </div>
      </Shell>
    </Band>
  );
}

function Shield() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M8 1.5l5 2v4c0 3-2.2 5.6-5 6.5-2.8-.9-5-3.5-5-6.5v-4l5-2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M5.8 7.8l1.6 1.6 3-3.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * How the money works.
 *
 * On the dark band because it is the section that has to feel solid. Each
 * claim here is implemented in services/api/src/payments and can be checked
 * against the code; none of them is a number about how many people use this.
 */
const MONEY = [
  {
    title: "The deposit sits in escrow",
    body: "Held from booking until the function is done. Neither side holds the other's money in the meantime.",
  },
  {
    title: "Vendors clear identity checks",
    body: "Anyone who can take a payout has been through Stripe Identity. That is enforced at the payout, not on the honour system.",
  },
  {
    title: "The price you agree is the price",
    body: "Fees are shown on the brief before you post it. Nothing is added at checkout.",
  },
];

export function Money() {
  return (
    <Band tone="dark" aria-labelledby="money-title">
      <Shell>
        <div className={styles.moneyGrid}>
          <SectionHead
            id="money-title"
            kicker="The money"
            title="Paid through escrow, not on trust"
            lede="The part everyone worries about, handled the boring way on purpose."
          />
          <ul className={styles.moneyPoints}>
            {MONEY.map((point) => (
              <li key={point.title} className={styles.moneyPoint}>
                <span className={styles.moneyIcon}>
                  <Shield />
                </span>
                <span>
                  <strong>{point.title}</strong>
                  <span>{point.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Shell>
    </Band>
  );
}

export function Section({
  children,
  tone,
  id,
}: {
  children: ReactNode;
  tone?: "paper" | "warm" | "dark";
  id?: string;
}) {
  return (
    <Band tone={tone} id={id}>
      <Shell>{children}</Shell>
    </Band>
  );
}
