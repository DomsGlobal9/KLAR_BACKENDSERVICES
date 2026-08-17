import { Request, Response } from "express";
import BookingService from "../services/booking.service";
import { mapToTripjackBooking } from "../utils/mappers/booking.mapper";
import { validateBookingPayload } from "../utils/tripjackBookingVerifier";
import { FlightReviewDataService } from "../services/flightReviewData.service";
import SeatService, { seatMapCacheKey } from "../services/seat.service";
import RedisCacheService from "../cache/redisCache.service";
import {
    verifyBookingAmount,
    BookingVerificationError,
} from "../utils/bookingVerification.util";
import {
    resolveBookingRequirements,
    isReviewExpired,
} from "../utils/reviewConditions.util";
import { AuthenticatedRequest, canAccessBooking } from "../middlewares/auth.middleware";
import { BookingRepository } from "../repositories/bookingLocal.repository";

const reviewDataService = new FlightReviewDataService();
const bookingRepo = new BookingRepository();

/**
 * Rebuild the payable amount and the conditional field requirements from the
 * stored Review, then validate the payload against both (C-1/C-4/H-4/H-5).
 *
 * This path books directly from the request body, so it needs the identical
 * treatment to the book-local path — otherwise it stays a way to bypass the
 * amount check entirely. Returns the payload with the verified amount applied.
 */
async function verifyAgainstReview(payload: any) {
    if (!payload?.bookingId) {
        throw new BookingVerificationError("bookingId is required", "BOOKING_ID_REQUIRED");
    }

    let review: any = null;
    try {
        review = await reviewDataService.getReviewDataByBookingId(payload.bookingId);
    } catch {
        review = null;
    }

    if (!review?.mappedData) {
        throw new BookingVerificationError(
            "No reviewed fare is on record for this booking. Please review the itinerary again before booking.",
            "REVIEW_MISSING",
            409
        );
    }

    const requirements = resolveBookingRequirements(review.mappedData);

    if (isReviewExpired(requirements, review.storedAt)) {
        throw new BookingVerificationError(
            "The reviewed fare has expired. Please search and review again.",
            "REVIEW_EXPIRED",
            409
        );
    }

    if (payload.isHold && !requirements.hold.allowed) {
        throw new BookingVerificationError(
            "This fare cannot be held. Please complete an instant booking instead.",
            "HOLD_NOT_ALLOWED"
        );
    }

    const travellers = payload.travellers || [];
    const seatsSelected = travellers.some((t: any) => t?.ssrSeatInfos?.length);

    let seatMap: any = null;
    if (seatsSelected) {
        try {
            seatMap = await RedisCacheService.get(seatMapCacheKey(payload.bookingId));
        } catch {
            seatMap = null;
        }
        if (!seatMap) {
            const fresh = await SeatService.getSeats(payload.bookingId);
            seatMap = fresh?.data ?? null;
        }
    }

    const verified = verifyBookingAmount({
        clientTripjackAmount: payload.amount,
        review: review.mappedData,
        seatMap,
        travellers,
    });

    const verifiedPayload = { ...payload, amount: verified.authoritativeAmount };

    validateBookingPayload(verifiedPayload, {
        requirements,
        departureDate:
            review.mappedData?.searchQuery?.routeInfos?.[0]?.travelDate,
    });

    return verifiedPayload;
}

/** Translate a verification/validation failure into its intended HTTP status. */
function sendBookingError(res: Response, error: any, fallbackMessage: string) {
    const status = error?.statusCode || error?.response?.status || 500;
    return res.status(status).json({
        success: false,
        message: error?.message || fallbackMessage,
        errorCode: error?.errorCode,
    });
}

class BookingController {
    emailVoucher(arg0: string, emailVoucher: any) {
        throw new Error("Method not implemented.");
    }
    getVoucherBase64(arg0: string, getVoucherBase64: any) {
        throw new Error("Method not implemented.");
    }
    previewVoucher(arg0: string, previewVoucher: any) {
        throw new Error("Method not implemented.");
    }
    generateVoucher(arg0: string, generateVoucher: any) {
        throw new Error("Method not implemented.");
    }
    getConfirmationPdf(arg0: string, getConfirmationPdf: any) {
        throw new Error("Method not implemented.");
    }

    async instantBook(req: Request, res: Response) {
        try {
            const verified = await verifyAgainstReview({ ...req.body, isHold: false });

            const mapped = mapToTripjackBooking(verified);

            const response = await BookingService.book(mapped);

            return res.status(200).json({
                success: true,
                data: response.data,
            });

        } catch (error: any) {
            return sendBookingError(res, error, "Booking failed");
        }
    }

    async holdBook(req: Request, res: Response) {
        try {
            const verified = await verifyAgainstReview({ ...req.body, isHold: true });

            const mapped = mapToTripjackBooking(verified);

            const response = await BookingService.book(mapped);

            return res.status(200).json({
                success: true,
                data: response.data,
            });

        } catch (error: any) {
            return sendBookingError(res, error, "Hold booking failed");
        }
    }

    async validateFare(req: Request, res: Response) {
        try {
            const { bookingId } = req.body;

            const response = await BookingService.validateFare(bookingId);

            return res.status(200).json(response.data);

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    async confirm(req: Request, res: Response) {
        try {
            const { bookingId } = req.body;

            if (!bookingId) {
                return res.status(400).json({
                    success: false,
                    message: "bookingId is required",
                });
            }

            // C-1 — the amount confirmed against a held PNR is derived from the
            // stored Review, not taken from the request body. Ancillaries were
            // already priced into the hold, so the reviewed total fare is the
            // figure to settle (Flights 1.8.2 p. 59).
            let review: any = null;
            try {
                review = await reviewDataService.getReviewDataByBookingId(bookingId);
            } catch {
                review = null;
            }

            const farePaise = review?.pricing?.farePaise;
            if (!farePaise || farePaise <= 0) {
                return res.status(409).json({
                    success: false,
                    message:
                        "No reviewed fare is on record for this booking, so it cannot be confirmed.",
                    errorCode: "REVIEW_MISSING",
                });
            }

            const response = await BookingService.confirmBooking(
                bookingId,
                farePaise / 100
            );

            return res.status(200).json(response.data);

        } catch (error: any) {
            return sendBookingError(res, error, "Confirm booking failed");
        }
    }

    async getBookingDetails(req: AuthenticatedRequest, res: Response) {
        try {
            const { bookingId } = req.params;

            if (!bookingId) {
                return res.status(400).json({
                    success: false,
                    message: "bookingId is required"
                });
            }

            // C-3 — this returns full traveller PII including passport data, so
            // knowing a booking id must not be enough to read it.
            const localBooking = await bookingRepo.getBookingById(String(bookingId)).catch(() => null);
            if (!localBooking || !canAccessBooking(req.user, localBooking)) {
                return res.status(404).json({
                    success: false,
                    message: `Booking ${bookingId} was not found.`,
                });
            }

            const response = await BookingService.getBookingDetails(bookingId as string);

            return res.status(200).json({
                success: true,
                data: response
            });

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

export default new BookingController();