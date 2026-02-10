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
 *               - EchoToken
 *               - PropertyId
 *               - BrandCode
 *               - PropertyCode
 *             properties:
 *               ConfirmationNumber:
 *                 type: string
 *               DemandCancelId:
 *                 type: string
 *               ReservationId:
 *                 type: string
 *               EchoToken:
 *                 type: string
 *               PropertyId:
 *                 type: string
 *               BrandCode:
 *                 type: string
 *               TimeStamp:
 *                 type: string
 *               PropertyCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reservation cancelled
 */

export const cancelController = async (req: Request, res: Response) => {
    const data = await cancelService.cancel(req.body, req.user?.id as string);
    res.json(data);
};
