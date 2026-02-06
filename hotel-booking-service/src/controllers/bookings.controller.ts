import { Request, Response } from 'express';
import bookingsService from '../services/bookings.service';

export class BookingsController {
    /**
     * @swagger
     * /api/booking/bookings:
     *   post:
     *     summary: Create a new booking (Direct Save)
     *     tags: [Booking]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - propertyId
     *               - propertyName
     *               - checkIn
     *               - checkOut
     *               - totalAmount
     *               - guests
     *               - rooms
     *             properties:
     *               propertyId:
     *                 type: string
     *               propertyName:
     *                 type: string
     *               checkIn:
     *                 type: string
     *                 format: date
     *               checkOut:
     *                 type: string
     *                 format: date
     *               totalAmount:
     *                 type: number
     *               currencyCode:
     *                 type: string
     *               walletId:
     *                 type: string
     *               paymentId:
     *                 type: string
     *               guests:
     *                 type: array
     *                 items:
     *                   type: object
     *               rooms:
     *                 type: array
     *                 items:
     *                   type: object
     *     responses:
     *       201:
     *         description: Booking created successfully
     *       401:
     *         description: Not authenticated
     *       500:
     *         description: Server error
     */
    public async createBooking(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
                return;
            }

            const booking = await bookingsService.createBooking(req.body, req.user.id);

            res.status(201).json({
                success: true,
                message: 'Booking created successfully',
                data: booking
            });

        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: 'Failed to create booking',
                error: error.message
            });
        }
    }
}

export default new BookingsController();
