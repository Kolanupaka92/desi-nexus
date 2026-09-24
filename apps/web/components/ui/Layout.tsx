import type { ElementType, ReactNode } from "react";
import styles from "./Layout.module.css";

/**
 * The layout primitives, as components.
 *
 * Wrapping the module in components rather than exporting class names is what
 * makes the constraint real: a page cannot compose `styles.shell` with its own
 * ad-hoc grid, because it never sees a class name. It picks a primitive or it
 * writes a module of its own, and either of those is a decision somebody can
 * find later.
 */

type Tone = "paper" | "warm" | "dark";

const TONE: Record<Tone, string | undefined> = {
  paper: undefined,
  warm: styles.bandPaper,
  dark: styles.bandDark,
};

export function Shell({
  children,
  narrow = false,
  className,
}: {
  children: ReactNode;
  narrow?: boolean;
  className?: string;
}) {
  return (
    <div className={cx(styles.shell, narrow && styles.narrow, className)}>{children}</div>
  );
}

/**
 * A full-width horizontal band.
 *
 * `as` exists so a band can be the <section> or <header> it semantically is.
 * A page of nested <div>s is a page a screen reader reads as one long run of
 * text with no landmarks to jump between.
 */
export function Band({
  children,
  tone = "paper",
  as: Tag = "section",
  className,
  ...rest
}: {
  children: ReactNode;
  tone?: Tone;
  as?: ElementType;
  className?: string;
  id?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <Tag className={cx(styles.band, TONE[tone], className)} {...rest}>
      {children}
    </Tag>
  );
}

export function Stack({
  children,
  space = "normal",
  as: Tag = "div",
  className,
}: {
  children: ReactNode;
  space?: "tight" | "normal" | "loose";
  as?: ElementType;
  className?: string;
}) {
  return (
    <Tag
      className={cx(
        styles.stack,
        space === "tight" && styles.stackTight,
        space === "loose" && styles.stackLoose,
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function Grid({
  children,
  size = "normal",
  as: Tag = "div",
  className,
}: {
  children: ReactNode;
  size?: "narrow" | "normal" | "wide";
  as?: ElementType;
  className?: string;
}) {
  return (
    <Tag
      className={cx(
        styles.grid,
        size === "narrow" && styles.gridNarrow,
        size === "wide" && styles.gridWide,
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** Join class names, dropping anything falsy. */
export function cx(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(" ");
}
