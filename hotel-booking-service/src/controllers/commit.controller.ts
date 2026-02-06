import { Request, Response } from "express";
import { commitService } from "../services/commit.service";

/**
 * @swagger
 * /api/booking/commit:
 *   post:
 *     summary: Commit a reservation
 *     tags: [Booking]
 *     security:
 *       - bearerAuth: []
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
 *         description: Reservation committed successfully
 *       401:
 *         description: Not authenticated
 */

export const commitController = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        const data = await commitService.commit(req.body, req.user.id);
        res.json(data);
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Failed to commit booking',
            error: error.message
        });
    }
};
