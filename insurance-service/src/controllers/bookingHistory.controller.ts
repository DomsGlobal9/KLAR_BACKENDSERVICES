import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { bookingHistoryService, normalizeEmail } from "../services/bookingHistory.service";

/**
 * GET /bookings/check-email?email=...
 *
 * Pre-OTP existence check for the B2C booking-history flow. Deliberately
 * mirrors flight's `/book-local/check-email` in both route shape and response
 * envelope so the portal treats every product the same way.
 *
 * Public by necessity — it runs before the customer has any token. It returns
 * a single boolean and nothing else: no counts, no booking ids, no customer
 * data. That is the same exposure the existing Flight, Hotel and Cab checks
 * already have, so this adds no new enumeration surface beyond confirming
 * that an address has *some* booking, which the portal already reveals.
 */
export const checkEmailController = async (req: Request, res: Response) => {
    try {
        const email = normalizeEmail(req.query.email);

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required",
            });
        }

        const exists = await bookingHistoryService.hasBookings(email);

        return res.status(200).json({
            success: true,
            data: { exists, email },
        });
    } catch (error: any) {
        const status = error?.status || 400;
        return res.status(status).json({
            success: false,
            message: error?.message || "Failed to check booking existence",
        });
    }
};

/**
 * GET /bookings/history
 *
 * Insurance bookings for the verified guest, after the existing OTP flow.
 *
 * The email is taken from the verified token, never from the request. The
 * guest token minted by auth-service on OTP verification carries
 * `email: <verified address>`, so the customer cannot ask for a different
 * address by editing a query parameter.
 *
 * This also avoids the shared-guest-identity problem: when a B2C caller
 * presents no usable token the auth middleware falls back to
 * `{ id: "b2c_guest_user" }` with no email, and that request is refused here
 * rather than being scoped to an identity every guest shares.
 */
export const bookingHistoryController = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const verifiedEmail = normalizeEmail(req.user?.email);

        if (!verifiedEmail) {
            return res.status(401).json({
                success: false,
                message: "A verified email is required to view booking history.",
                code: "EMAIL_NOT_VERIFIED",
            });
        }

        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;

        const data = await bookingHistoryService.listByEmail(verifiedEmail, page, limit);
        return res.status(200).json(data);
    } catch (error: any) {
        const status = error?.status || 500;
        return res.status(status).json({
            status: false,
            statusCode: status,
            message: error?.message || "Failed to load insurance booking history",
        });
    }
};
