/**
 * Removing people who break the marketplace rules.
 *
 * The rule (see /rules on the site): a client or vendor met through Utsav is
 * not taken off the platform to avoid it. Anyone who does is suspended.
 *
 * SUSPENDED, NOT DELETED. To everyone using the app a suspended account is
 * gone -- it cannot sign in or refresh a session (auth.ts), it disappears from
 * search and its public profile 404s (discovery.ts), and it cannot be offered
 * a booking (gigs.ts). But the row stays: 003 withholds DELETE on users from
 * the application role, because a user's bookings, reviews and ledger entries
 * reference it and the ledger is a financial record that must outlive a ban.
 * And a removal made in error has to be undoable, which a DELETE is not.
 *
 * Visibility is filtered when it is read, never by editing the vendor's
 * profile. So reinstating someone restores everything at once, with nothing
 * to remember to put back.
 */
import { HttpError, type Router } from "../router.js";
import { authenticate, field, isString, requireRole } from "../middleware.js";
import type { AppDeps } from "../../app.js";

/** Long enough to explain; short enough that it is a reason, not a dossier. */
const MAX_REASON_LENGTH = 1000;

export function registerAdminRoutes(router: Router, deps: AppDeps): void {
  const { config, store } = deps;
  const requireAuth = authenticate(config.tokenSecret);

  router.post(
    "/v1/admin/users/:userId/suspend",
    async (ctx) => {
      const adminId = ctx.auth?.sub as string;
      const userId = ctx.params.userId as string;
      const reason = field(ctx, "reason", isString).trim();

      // The reason is what an appeal is decided on, and what the person is told.
      // The schema refuses a blank one too (010); this says so usefully.
      if (reason.length === 0) {
        throw new HttpError(400, "reason_required", "a suspension needs a reason");
      }
      if (reason.length > MAX_REASON_LENGTH) {
        throw new HttpError(400, "reason_too_long", `keep the reason under ${MAX_REASON_LENGTH} characters`);
      }
      // An administrator suspending themselves would lock out the one person
      // able to reverse it.
      if (userId === adminId) {
        throw new HttpError(400, "cannot_suspend_self", "an administrator cannot suspend their own account");
      }

      const target = await store.users.byId(userId);
      if (!target) throw new HttpError(404, "not_found", "user not found");
      // Refused rather than overwritten: the original reason is the record an
      // appeal is judged against, and a second suspension would erase it.
      if (target.suspendedAt) {
        throw new HttpError(409, "already_suspended", "this account is already suspended");
      }

      const suspended = await store.users.suspend(userId, {
        at: new Date().toISOString(),
        reason,
        by: adminId,
      });
      return {
        status: 200,
        body: {
          user: {
            id: suspended.id,
            suspendedAt: suspended.suspendedAt,
            suspensionReason: suspended.suspensionReason,
            suspendedBy: suspended.suspendedBy,
          },
        },
      };
    },
    requireAuth,
    requireRole("admin"),
  );

  router.post(
    "/v1/admin/users/:userId/reinstate",
    async (ctx) => {
      const userId = ctx.params.userId as string;
      const target = await store.users.byId(userId);
      if (!target) throw new HttpError(404, "not_found", "user not found");
      if (!target.suspendedAt) {
        throw new HttpError(409, "not_suspended", "this account is not suspended");
      }
      const reinstated = await store.users.reinstate(userId);
      return { status: 200, body: { user: { id: reinstated.id, suspendedAt: null } } };
    },
    requireAuth,
    requireRole("admin"),
  );
}
