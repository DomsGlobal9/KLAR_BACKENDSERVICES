import { Request, Response } from "express";
import CancellationService from "../services/cancellation.service";
import { mapToAmendmentPayload } from "../utils/mappers/cancellation.mapper";
import { validateCancellationPayload } from "../utils/cancellationVerifier";
import { AuthenticatedRequest, canAccessBooking } from "../middlewares/auth.middleware";
import { BookingRepository } from "../repositories/bookingLocal.repository";

const bookingRepo = new BookingRepository();

/**
 * Confirm the caller owns the booking before any amendment acts on it (C-3).
 *
 * Cancellation is irreversible, so knowing a booking id must not be enough to
 * cancel someone else's ticket. Returns an error response to send, or null
 * when access is allowed.
 */
async function assertBookingAccess(
    req: AuthenticatedRequest,
    bookingId: string
): Promise<{ status: number; body: any } | null> {
    if (!bookingId) {
        return { status: 400, body: { success: false, message: "bookingId is required" } };
    }

    const booking = await bookingRepo.getBookingById(bookingId).catch(() => null);

    // Not held locally — nothing to authorise against. Refuse rather than
    // guess, so an unknown id cannot be used to reach TripJack.
    if (!booking) {
        return {
            status: 404,
            body: { success: false, message: `Booking ${bookingId} was not found.` },
        };
    }

    if (!canAccessBooking(req.user, booking)) {
        // 404 rather than 403: a booking the caller does not own must not be
        // distinguishable from one that does not exist.
        return {
            status: 404,
            body: { success: false, message: `Booking ${bookingId} was not found.` },
        };
    }

    return null;
}

class CancellationController {
    async getCharges(req: AuthenticatedRequest, res: Response) {
        try {
            const denied = await assertBookingAccess(req, req.body?.bookingId);
            if (denied) return res.status(denied.status).json(denied.body);

            const payload = mapToAmendmentPayload(req.body);

            validateCancellationPayload(payload);

            const response = await CancellationService.getCharges(payload);


            return res.status(200).json({
                success: true,
                data: response,
            });

        } catch (error: any) {


            // ✅ Handle your custom thrown error from service
            if (error?.httpStatus) {
                return res.status(error.httpStatus).json({
                    success: false,
                    ...error.raw   // 🔥 send full Tripjack response
                });
            }

            // fallback
            return res.status(500).json({
                success: false,
                message: error.message || "Internal Server Error",
            });
        }
    }

    async submit(req: AuthenticatedRequest, res: Response) {
        try {
            const denied = await assertBookingAccess(req, req.body?.bookingId);
            if (denied) return res.status(denied.status).json(denied.body);

            const payload = mapToAmendmentPayload(req.body);

            validateCancellationPayload(payload);

            const response = await CancellationService.submit(payload);

            return res.status(200).json({
                success: true,
                data: response.data,
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    async status(req: AuthenticatedRequest, res: Response) {
        try {
            const { amendmentId, bookingId } = req.body;

            if (!amendmentId) {
                return res.status(400).json({
                    success: false,
                    message: "amendmentId is required",
                });
            }

            // When the caller names the booking, authorise against it. Polling
            // is otherwise scoped by the amendment id issued to that caller.
            if (bookingId) {
                const denied = await assertBookingAccess(req, bookingId);
                if (denied) return res.status(denied.status).json(denied.body);
            }

            const response = await CancellationService.status(amendmentId);

            return res.status(200).json({
                success: true,
                data: response.data,
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
}

export default new CancellationController();