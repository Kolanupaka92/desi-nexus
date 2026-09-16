/**
 * The public contact form's endpoint.
 *
 * Every other way into this marketplace requires an account. That is correct
 * for booking -- money and identity both depend on knowing who somebody is --
 * and it was, until now, also the only way to ask a question. A visitor who
 * arrived from a WhatsApp link with a date and a question had to register,
 * verify a phone and fill in a structured gig brief before they could say
 * anything at all, which for this audience is the funnel closing on itself.
 *
 * So this endpoint is deliberately the one place on the service that takes
 * input from somebody with no session. Three things follow from that, and each
 * is a rule below rather than a hope:
 *
 *  * It is the strictest rate-limited write on the platform. An anonymous
 *    endpoint that creates rows is what a spam script finds first.
 *  * It returns nothing but an id. No echo of what was submitted, no lookup,
 *    no list -- the application's database role has INSERT on `enquiries` and
 *    no SELECT at all (migration 006), so a list endpoint here could not be
 *    written even by mistake.
 *  * What it accepts is bounded and normalised before it reaches the database,
 *    so a constraint violation is a bug rather than a user's error message.
 */
import { randomUUID } from "node:crypto";
import { HttpError, type Router } from "../router.js";
import { field, isString, rateLimit } from "../middleware.js";
import { ValidationError } from "../../domain/users.js";
import { normaliseEnquiry, validateEnquiry } from "../../domain/enquiry.js";
import { isEventType } from "../../domain/taxonomy.js";
import { TEXAS_METROS } from "../../domain/geo.js";
import { TOPICS } from "../../events/bus.js";
import type { AppDeps } from "../../app.js";

export function registerEnquiryRoutes(router: Router, deps: AppDeps): void {
  const { store, bus, limiter } = deps;

  router.post(
    "/v1/enquiries",
    async (ctx) => {
      const body = (ctx.body ?? {}) as Record<string, unknown>;

      /*
       * A honeypot, not a captcha.
       *
       * The form renders a field no human sees and no human fills in. A bot
       * posting every field it finds fills it, and gets a 202 saying thank you
       * -- the same response a real visitor gets, because telling a spammer
       * which of their submissions were dropped is how they tune around it.
       * Nothing is written.
       *
       * This is a speed bump, not a defence; the rate limit below is the
       * defence. It is here because it costs one field and catches the
       * untargeted majority.
       */
      if (typeof body.website === "string" && body.website.trim() !== "") {
        return { status: 202, body: { received: true } };
      }

      // Required, and named in the error so the form can point at the field.
      field(ctx, "name", isString);
      field(ctx, "email", isString);
      field(ctx, "message", isString);

      const enquiry = normaliseEnquiry({ id: randomUUID(), ...body } as never);

      // The taxonomy and the metro list are closed sets, and a value outside
      // them is a foreign key violation at the database -- which would surface
      // as a 500 on a form somebody filled in correctly except for one select.
      // Dropping an unrecognised value is right rather than rejecting: the
      // enquiry is still worth having, and the message says what they want.
      if (enquiry.eventType !== undefined && !isEventType(enquiry.eventType)) {
        delete (enquiry as { eventType?: string }).eventType;
      }
      if (
        enquiry.metroCode !== undefined &&
        !TEXAS_METROS.some((metro) => metro.id === enquiry.metroCode)
      ) {
        delete (enquiry as { metroCode?: string }).metroCode;
      }

      try {
        validateEnquiry(enquiry);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new HttpError(400, "invalid_request", error.message, { field: error.field });
        }
        throw error;
      }

      await store.enquiries.create(enquiry);

      /*
       * The event carries no message body and no phone number.
       *
       * Subscribers to this topic route and notify; none of them needs the
       * contents, and an outbox row is the one copy of this data that leaves
       * the table its row-level security protects. What is here is enough to
       * say "somebody asked about a Sangeet in Dallas-Fort Worth, go and look".
       */
      await bus.publish(
        TOPICS.enquiryReceived,
        enquiry.id,
        {
          enquiryId: enquiry.id,
          ...(enquiry.eventType ? { eventType: enquiry.eventType } : {}),
          ...(enquiry.metroCode ? { metroCode: enquiry.metroCode } : {}),
          ...(enquiry.eventDate ? { eventDate: enquiry.eventDate } : {}),
          receivedAt: enquiry.createdAt,
        },
        ctx.traceId,
      );

      // 202, not 201: the row exists, but what the visitor actually asked for
      // is a reply from a person, and that has not happened yet.
      return { status: 202, body: { received: true, id: enquiry.id } };
    },
    rateLimit(limiter, "enquiry"),
  );
}
