"use client";

import { useActionState } from "react";
import { enquiryAction } from "@/lib/actions";
import { Submit } from "@/components/Form";

/**
 * The form a visitor can use without an account.
 *
 * On success the fields are replaced by the confirmation rather than cleared
 * and left standing. A form that empties itself after submission reads as a
 * failure -- people re-send, which is how a contact inbox fills with
 * duplicates -- and a green banner above a still-editable form is ambiguous
 * about whether anything was sent.
 */
export function EnquiryForm({
  occasions,
  metros,
  source,
  compact = false,
}: {
  readonly occasions: ReadonlyArray<readonly [string, string]>;
  readonly metros: ReadonlyArray<readonly [string, string]>;
  /** The page this was submitted from, for attribution. */
  readonly source: string;
  /** Drops the optional row, for placements with less room. */
  readonly compact?: boolean;
}) {
  const [state, formAction] = useActionState(enquiryAction, {});

  if (state.notice) {
    return (
      <div className="enquiry-done" role="status">
        <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true" focusable="false">
          <circle cx="17" cy="17" r="16" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.45" />
          <path d="M10 17.5l4.6 4.5L24 12.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h3>That is with us.</h3>
        <p>{state.notice}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="enquiry">
      {state.error && (
        <div className="notice error" role="alert">
          {state.error}
        </div>
      )}

      <input type="hidden" name="source" value={source} />

      {/*
        The honeypot. Not `type="hidden"` -- plenty of bots skip those -- and
        not `display: none` either, which some of them also check. It is a real
        text input moved out of the viewport, taken out of the tab order, and
        told not to autofill, so a person never meets it and a script filling
        in every field it finds does.
      */}
      <div className="hp" aria-hidden="true">
        <label htmlFor="enq-website">Leave this empty</label>
        <input id="enq-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="enquiry-row">
        <div className="field">
          <label htmlFor="enq-name">Your name</label>
          <input id="enq-name" name="name" required autoComplete="name" maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="enq-email">Email</label>
          <input id="enq-email" name="email" type="email" required autoComplete="email" inputMode="email" />
        </div>
      </div>

      <div className="enquiry-row">
        <div className="field">
          <label htmlFor="enq-phone">
            Phone <span className="optional">optional</span>
          </label>
          {/* No pattern attribute: the API takes the number as typed, and a
              browser rejecting "(469) 555-0123" would be rejecting the format
              most people actually use. */}
          <input id="enq-phone" name="phone" type="tel" autoComplete="tel" />
        </div>
        <div className="field">
          <label htmlFor="enq-occasion">
            Occasion <span className="optional">optional</span>
          </label>
          <select id="enq-occasion" name="eventType" defaultValue="">
            <option value="">Not sure yet</option>
            {occasions.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!compact && (
        <div className="enquiry-row">
          <div className="field">
            <label htmlFor="enq-date">
              Date <span className="optional">optional</span>
            </label>
            <input id="enq-date" name="eventDate" type="date" />
          </div>
          <div className="field">
            <label htmlFor="enq-metro">
              Where <span className="optional">optional</span>
            </label>
            <select id="enq-metro" name="metroCode" defaultValue="">
              <option value="">Somewhere else in Texas</option>
              {metros.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="field">
        <label htmlFor="enq-message">What are you planning?</label>
        <textarea
          id="enq-message"
          name="message"
          required
          minLength={10}
          maxLength={4000}
          rows={4}
          placeholder="A Sangeet in Frisco next March — we need a MUA and a photographer, and the family speaks Telugu."
        />
        <p className="hint">
          The more specific the better. The occasion matters more than the budget.
        </p>
      </div>

      <div className="enquiry-actions">
        <Submit className="btn gold">Send enquiry</Submit>
        <span className="hint">No account needed. We do not share your details with anyone.</span>
      </div>
    </form>
  );
}
