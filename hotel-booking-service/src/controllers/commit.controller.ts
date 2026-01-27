import { Request, Response } from "express";
import { commitService } from "../services/commit.service";

/**
 * @swagger
 * /api/booking/commit:
 *   post:
 *     summary: Commit a reservation
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
 *         description: Reservation committed
 */

export const commitController = async (req: Request, res: Response) => {
    const data = await commitService.commit(req.body);
    res.json(data);
};
