import { Request, Response } from "express";
import { specialRequestsService } from "../services/special-requests.service";

/**
 * @swagger
 * /api/booking/special-requests:
 *   get:
 *     summary: Fetch a list of additive special request codes
 *     tags: [Booking]
 *     responses:
 *       200:
 *         description: A list of special requests
 */

export const specialRequestsController = async (_req: Request, res: Response) => {
    try {
        const data = await specialRequestsService.getSpecialRequests();
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ status: false, message: error.message });
    }
};
