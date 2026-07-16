import { StructuredError } from "../services/StructuredError";
import { ICabBooking } from "../models/CabBooking.model";

/**
 * The identity a request is allowed to act as. Built from the verified JWT
 * (`req.user`) plus, for tokenless guests, a capability proof they must present
 * in the request (the exact passenger email or the Razorpay payment id on the
 * booking). This is what lets us stop treating a bare `bookingId` as authority
 * to cancel/read someone else's ride.
 */
export interface Caller {
  id?: string;
  email?: string;
  isAdmin?: boolean;
  proofEmail?: string; // guest capability: email supplied in the request
  proofPaymentId?: string; // guest capability: razorpayPaymentId supplied in the request
}

const lc = (v: any): string | undefined =>
  v === undefined || v === null || v === "" ? undefined : String(v).toLowerCase();

/** Extract the caller identity from an (optionally authenticated) request. */
export function resolveCaller(req: any): Caller {
  const u = req?.user;
  const roles = [u?.role, ...(Array.isArray(u?.roles) ? u.roles : [])]
    .filter(Boolean)
    .map((r: string) => String(r).toLowerCase());

  return {
    id: u ? String(u.userId || u.id || u._id || "") || undefined : undefined,
    email: lc(u?.email),
    isAdmin: roles.includes("admin") || roles.includes("superadmin"),
    proofEmail: lc(req?.body?.email ?? req?.query?.email),
    proofPaymentId:
      (req?.body?.razorpayPaymentId ?? req?.query?.razorpayPaymentId) || undefined,
  };
}

/**
 * Whether `caller` is allowed to act on `booking`.
 *
 *  • admins: always;
 *  • token owner: the caller's user id matches the booking's agentId / userId /
 *    userInfo.id (B2B agent or logged-in B2C customer);
 *  • guest capability: the caller presents the exact passenger email *and* it
 *    matches, or the exact razorpayPaymentId on the booking. A bookingId alone
 *    is never enough.
 */
export function ownsBooking(booking: ICabBooking | null | undefined, caller: Caller): boolean {
  if (!booking) return false;
  if (caller.isAdmin) return true;

  if (caller.id && [booking.agentId, booking.userId, booking.userInfo?.id].some((v) => v && v === caller.id)) {
    return true;
  }

  const callerEmail = caller.email || caller.proofEmail;
  if (callerEmail) {
    const bookingEmails = [booking.userInfo?.email, booking.userId, booking.passenger?.email]
      .map(lc)
      .filter(Boolean);
    if (bookingEmails.includes(callerEmail)) return true;
  }

  if (
    caller.proofPaymentId &&
    booking.razorpayPaymentId &&
    caller.proofPaymentId === booking.razorpayPaymentId
  ) {
    return true;
  }

  return false;
}

/** Throw NOT_FOUND / FORBIDDEN unless the caller owns the booking. */
export function assertBookingOwnership(
  booking: ICabBooking | null | undefined,
  caller: Caller,
): asserts booking is ICabBooking {
  if (!booking) {
    throw new StructuredError("NOT_FOUND", "Booking not found.");
  }
  if (!ownsBooking(booking, caller)) {
    throw new StructuredError(
      "FORBIDDEN",
      "You are not allowed to access this booking.",
    );
  }
}
