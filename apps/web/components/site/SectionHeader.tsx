import type { ReactNode } from "react";

/**
 * The eyebrow / heading / lede block that opens every section.
 *
 * It was copied inline into each band with slightly different markup and an
 * inline `style` on the eyebrow to recolour it for paper backgrounds -- which
 * is why the colour was wrong on two of them. The `tone` prop replaces that
 * inline style: a section says which ground it is on and the colour follows.
 */
export function SectionHeader({
  eyebrow,
  title,
  lede,
  tone = "dark",
  align = "start",
  id,
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  /** Which ground this sits on, so the eyebrow picks a readable colour. */
  tone?: "dark" | "paper";
  align?: "start" | "center";
  /** Set when a heading is the label for an aria-labelledby region. */
  id?: string;
}) {
  return (
    <div className={`band-head${align === "center" ? " centered" : ""}`}>
      {eyebrow && <span className={`eyebrow${tone === "paper" ? " on-paper" : ""}`}>{eyebrow}</span>}
      <h2 id={id}>{title}</h2>
      {lede && <p>{lede}</p>}
    </div>
  );
}
