import { JsonLd } from "./JsonLd";

export interface QandA {
  readonly q: string;
  readonly a: string;
}

/**
 * An FAQ, as <details> rather than a scripted accordion.
 *
 * Native disclosure gives keyboard operation, the correct ARIA semantics and
 * open-by-find-in-page for free, and works before hydration. A div with an
 * onClick gets none of that and is the usual way an FAQ ends up unusable with a
 * keyboard.
 *
 * The answers are also emitted as FAQPage structured data, which is the one
 * piece of rich-result markup this site can honestly claim: the questions
 * below are answered by the platform's actual policies -- escrow, refunds,
 * travel quoting -- and the JSON-LD says exactly what the visible answer says,
 * which is the condition Google's guidelines put on it.
 */
export function Faq({ items, heading }: { items: readonly QandA[]; heading?: string }) {
  return (
    <div className="faq">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }}
      />
      {heading && <h3 className="sr-only">{heading}</h3>}
      {items.map((item) => (
        <details key={item.q} className="faq-item">
          <summary>
            <span>{item.q}</span>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
              <path d="M7 1v12M1 7h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </summary>
          <p>{item.a}</p>
        </details>
      ))}
    </div>
  );
}
