import { Request, Response } from "express";
import { cancelService } from "../services/cancel.service";

/**
 * @swagger
 * /api/booking/cancel:
 *   post:
 *     summary: Cancel a reservation
 *     tags: [Booking]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ConfirmationNumber
 *               - ReservationId
 *               - DemandCancelId
 *               - PropertyId
 *               - PropertyCode
 *             properties:
 *               ConfirmationNumber:
 *                 type: string
 *                 example: "CNF123456789"
 *               DemandCancelId:
 *                 type: string
 *                 example: "demandcancel12534"
 *               ReservationId:
 *                 type: string
 *                 example: "RES987654321"
 *               EchoToken:
 *                 type: string
 *                 example: "t456Sl40SdXelBv78923"
 *               PropertyId:
 *                 type: string
 *                 example: "ChIJCYQhdhVDXz4R5lEANKNzFlA"
 *               PropertyCode:
 *                 type: string
 *                 example: "42424"
 *               TimeStamp:
 *                 type: string
 *                 example: "2026-06-01T10:32:45.000Z"
 *     responses:
 *       200:
 *         description: Reservation cancelled successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Internal server error
 */

export const cancelController = async (req: Request, res: Response) => {
    try {
        const data = await cancelService.cancel(req.body, req.user?.id as string);
        res.json(data);
    } catch (error: any) {
        console.error("Cancel Controller Error:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            status: false,
            statusCode: error.response?.status || 500,
            description: error.response?.data?.description || error.response?.data?.message || error.message || "Internal Server Error",
            body: null
        });
    }
};
