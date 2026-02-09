import { Request, Response } from "express";
import { precheckService } from "../services/precheck.service";

/**
 * @swagger
 * /api/booking/precheck:
 *   post:
 *     summary: Validate a potential booking before final commitment
 *     tags: [Booking]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               BookReservation:
 *                 $ref: '#/components/schemas/RateGainBookReservation'
 *     responses:
 *       200:
 *         description: Precheck successful
 */

export const precheckController = async (req: Request, res: Response) => {
    try {
        const data = await precheckService.precheck(req.body);
        res.json(data);
    } catch (error: any) {
        console.error("Precheck Controller Error:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            status: false,
            statusCode: error.response?.status || 500,
            message: error.response?.data?.description || error.response?.data?.message || error.message || "Internal Server Error"
        });
    }
};
