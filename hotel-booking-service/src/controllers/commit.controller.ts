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
        // Authentication removed temporarily for testing
        const userId = req.user?.id || 'guest-user';
        const data = await commitService.commit(req.body, userId);
        res.json(data);
    } catch (error: any) {
        const statusCode = error.response?.status || 500;
        const errorData = error.response?.data || {};

        console.error('Commit Controller Error:', error.message);

        res.status(statusCode).json({
            success: false,
            message: errorData.description || error.message || 'Failed to commit booking',
            error: errorData
        });
    }
};
