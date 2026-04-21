import { Request, Response } from "express";
import { TripjackCancellationService } from "../services/tripjackCancellation.service";

/**
 * GET CANCELLATION CHARGES
 */
export const getCancellationCharges = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { bookingId } = req.body;

        if (!bookingId) {
            res.status(400).json({ message: "bookingId is required" });
            return;
        }

        const response =
            await TripjackCancellationService.getAmendmentCharges({
                bookingId,
                type: "CANCELLATION",
                remarks: "Checking cancellation charges",
            });

        res.json({ success: true, data: response });
    } catch (error) {
        console.error("Error fetching cancellation charges:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * CONFIRM CANCELLATION
 */
export const cancelBooking = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { bookingId } = req.body;

        if (!bookingId) {
            res.status(400).json({ message: "bookingId is required" });
            return;
        }

        const submit =
            await TripjackCancellationService.submitAmendment({
                bookingId,
                type: "CANCELLATION",
                remarks: "User confirmed cancellation",
            });

        const finalStatus =
            await TripjackCancellationService.pollAmendmentStatus(
                submit.amendmentId
            );

        res.json({
            success: true,
            data: finalStatus,
        });
    } catch (error) {
        console.error("Error cancelling booking:", error);
        res.status(500).json({ success: false, message: "Cancellation failed" });
    }
};

/**
 * CHECK STATUS (OPTIONAL API)
 */
export const getCancellationStatus = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { amendmentId } = req.body;

        if (!amendmentId) {
            res.status(400).json({ message: "amendmentId is required" });
            return;
        }

        const response =
            await TripjackCancellationService.getAmendmentDetails({
                amendmentId,
            });

        res.json({ success: true, data: response });
    } catch (error) {
        console.error("Error fetching status:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};