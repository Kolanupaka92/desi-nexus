import type { ReactNode } from "react";
import styles from "./StatusPanel.module.css";
import { Band, Shell } from "@/components/ui/Layout";

/**
 * A page-sized message with a way out: eyebrow, headline, explanation, actions.
 *
 * Deliberately free of anything server-only -- no `cookies()`, no async, no
 * data fetching -- because `app/error.tsx` has to be a client component and
 * renders this too. Keep it that way, or the error boundary stops compiling.
 */
export function StatusPanel({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <Band tone="paper">
      <Shell>
        <div className={styles.panel}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.body}>{children}</div>
          <div className={styles.actions}>{actions}</div>
        </div>
      </Shell>
    </Band>
  );
}
