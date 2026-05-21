import { Request, Response } from "express";
import { TripJackApiProvider } from "../providers/tripjack.api.provider";

/**
 * Controller to confirm a previously HELD booking.
 * POST /confirm
 */
export const confirmController = async (req: Request, res: Response) => {
    try {
        console.log("[ConfirmController] Processing confirmation for:", req.body.bookingId);
        const provider = new TripJackApiProvider();
        const result = await provider.confirmBook(req.body);
        
        res.status(200).json({
            status: true,
            statusCode: 200,
            description: "TripJack Confirmation Success",
            body: result
        });
    } catch (error: any) {
        console.error("[ConfirmController] Error:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            status: false,
            statusCode: error.response?.status || 500,
            description: error.response?.data?.description || error.message,
            body: error.response?.data
        });
    }
};
