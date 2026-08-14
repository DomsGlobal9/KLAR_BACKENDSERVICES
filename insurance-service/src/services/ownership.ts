import { InsuranceBookingModel } from "../models/InsuranceBooking.model";

/**
 * Shared ownership checks for insurance bookings.
 *
 * `list.service.ts` already scopes its query to the caller and fails closed
 * when no owner is present. The single-booking routes did not: `/bookings/:id`,
 * `/booking-details`, `/amendment/raise` and `/amendment/cancel` each took a
 * booking id straight from the request and went to Mongo or TripJack with it,
 * with no reference to `req.user` at all. Any authenticated caller could
 * therefore read — and, through `/amendment/cancel`, destroy — another
 * customer's policy.
 *
 * This module is the one place that decides "is this booking yours", so the
 * four call sites cannot drift apart.
 */

/** Pulls the caller's id out of a decoded JWT, matching list.controller.ts. */
export function ownerIdFrom(user: any): string | undefined {
    return user?.userId || user?.id || user?._id;
}

/**
 * Mongo filter restricting results to bookings belonging to [ownerId].
 *
 * Both keys are checked because `book.service.ts` writes the caller's id to
 * `agentId` and mirrors it into `userId`.
 */
export function ownerFilter(ownerId: string) {
    return { $or: [{ agentId: ownerId }, { userId: ownerId }] };
}

/**
 * Throws unless [ownerId] owns the booking identified by [bookingId].
 *
 * Fails closed: a missing [ownerId] is rejected rather than treated as
 * "no filter", which is the bug that made `list.service.ts` dump the whole
 * collection before it was fixed.
 *
 * A booking that exists but belongs to someone else returns 404, not 403, so
 * the response cannot be used to confirm which booking ids are real.
 */
export async function assertOwnsBooking(
    bookingId: string,
    ownerId?: string
): Promise<void> {
    if (!bookingId) {
        throw { status: 400, message: "bookingId is required." };
    }
    if (!ownerId) {
        throw { status: 401, message: "Authentication required." };
    }

    const owned = await InsuranceBookingModel.exists({
        bookingId,
        ...ownerFilter(ownerId),
    });

    if (!owned) {
        throw {
            status: 404,
            message: `Insurance booking reference "${bookingId}" not located in database.`,
        };
    }
}
