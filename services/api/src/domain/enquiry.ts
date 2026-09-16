/**
 * An enquiry: somebody who is not a user, asking a question.
 *
 * The marketplace's only front door was "post a brief", which needs an
 * account, a verified phone and a structured gig. That is right for a host
 * ready to book and wrong for the larger group who arrive first: a visitor
 * from a shared link, with a date and a question, who wants an answer before
 * they commit to anything. Asking them to register in order to ask is the
 * funnel closing on itself.
 *
 * So this is deliberately the smallest thing that can be acted on. Name, a way
 * to reach them, roughly what and roughly when, and what they actually want to
 * say. Everything except the message and the contact details is optional,
 * because a required field on a contact form is a lead that leaves.
 */
import { ValidationError } from "./users.js";

export type EnquiryStatus = "new" | "contacted" | "converted" | "spam" | "closed";

export interface Enquiry {
  readonly id: string;
  name: string;
  email: string;
  phone?: string;
  /** A taxonomy code, absent when the visitor picked "something else". */
  eventType?: string;
  /** ISO date. Absent is normal: half of them do not have a date yet. */
  eventDate?: string;
  metroCode?: string;
  message: string;
  /** The page the form was on, for attribution. */
  source?: string;
  status: EnquiryStatus;
  readonly createdAt: string;
}

/**
 * Bounds, matching the CHECK constraints in 006 so the two cannot disagree.
 *
 * The service checks first and returns a message naming the field, because a
 * constraint violation surfacing as a 500 is how a form becomes unusable
 * without anybody hearing about it. The constraints stay as the backstop for
 * anything reaching the table another way.
 */
export const ENQUIRY_LIMITS = {
  name: { min: 2, max: 120 },
  phone: { min: 7, max: 32 },
  message: { min: 10, max: 4000 },
  source: { max: 200 },
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function bounded(value: string, field: string, limits: { min: number; max: number }): string {
  const trimmed = value.trim();
  if (trimmed.length < limits.min || trimmed.length > limits.max) {
    throw new ValidationError(
      field,
      `${field} must be between ${limits.min} and ${limits.max} characters`,
    );
  }
  return trimmed;
}

export function validateEnquiry(enquiry: Enquiry): void {
  bounded(enquiry.name, "name", ENQUIRY_LIMITS.name);
  if (!enquiry.email || !EMAIL.test(enquiry.email)) {
    throw new ValidationError("email", "a valid email address is required");
  }
  // Phone is optional, and stays loose on purpose. Registration demands E.164
  // because the OTP provider does; nobody is sending an OTP to this number, and
  // rejecting "(469) 555-0123" would cost a lead to buy nothing.
  if (enquiry.phone !== undefined) bounded(enquiry.phone, "phone", ENQUIRY_LIMITS.phone);
  bounded(enquiry.message, "message", ENQUIRY_LIMITS.message);

  if (enquiry.eventDate !== undefined) {
    if (!ISO_DATE.test(enquiry.eventDate) || Number.isNaN(Date.parse(enquiry.eventDate))) {
      throw new ValidationError("eventDate", "eventDate must be an ISO date (YYYY-MM-DD)");
    }
  }
  if (enquiry.source !== undefined && enquiry.source.length > ENQUIRY_LIMITS.source.max) {
    throw new ValidationError("source", "source is too long");
  }
}

/**
 * Trim and normalise what a form actually sends.
 *
 * Separate from validation because these are not errors: a trailing space on
 * an email address and a capital letter in it are both things to fix rather
 * than to reject. Empty optional fields arrive as "" from an HTML form and
 * become absent here, so the difference between "not answered" and "answered
 * with nothing" does not reach the database as two different values.
 */
export function normaliseEnquiry(input: {
  id: string;
  name: unknown;
  email: unknown;
  phone?: unknown;
  eventType?: unknown;
  eventDate?: unknown;
  metroCode?: unknown;
  message: unknown;
  source?: unknown;
}): Enquiry {
  const text = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  };

  return {
    id: input.id,
    name: text(input.name) ?? "",
    email: (text(input.email) ?? "").toLowerCase(),
    ...(text(input.phone) ? { phone: text(input.phone) as string } : {}),
    ...(text(input.eventType) ? { eventType: text(input.eventType) as string } : {}),
    ...(text(input.eventDate) ? { eventDate: text(input.eventDate) as string } : {}),
    ...(text(input.metroCode) ? { metroCode: text(input.metroCode) as string } : {}),
    message: text(input.message) ?? "",
    ...(text(input.source) ? { source: text(input.source) as string } : {}),
    status: "new",
    createdAt: new Date().toISOString(),
  };
}
