import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";
import { cx } from "./Layout";

type Tone = "accent" | "primary" | "secondary" | "ghostLight";
type Size = "normal" | "large" | "small";

interface Common {
  children: ReactNode;
  tone?: Tone;
  size?: Size;
  full?: boolean;
  className?: string;
}

function classes({ tone = "primary", size = "normal", full, className }: Common) {
  return cx(
    styles.btn,
    styles[tone],
    size === "large" && styles.large,
    size === "small" && styles.small,
    full && styles.full,
    className,
  );
}

/**
 * A button, or a link that looks like one.
 *
 * Two components rather than one with an `href` prop, because the choice
 * between `<a>` and `<button>` is not styling. A link navigates and belongs in
 * the tab order as a link; a button submits or acts. Collapsing them into one
 * component is how you end up with a `<div onClick>` that a keyboard cannot
 * reach and a screen reader does not announce.
 */
export function Button({
  href,
  ...props
}: Common & { href: string }) {
  return (
    <Link href={href} className={classes(props)}>
      {props.children}
    </Link>
  );
}

export function ActionButton({
  type = "button",
  ...props
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { children, tone, size, full, className, ...rest } = props;
  return (
    <button type={type} className={classes({ children, tone, size, full, className })} {...rest}>
      {children}
    </button>
  );
}
