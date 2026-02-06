import { Request, Response } from 'express';
import bookingHistoryService from '../services/booking-history.service';

export class BookingHistoryController {
    /**
     * Get all bookings for authenticated user
     * GET /bookings
     */
    public async getBookings(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
                return;
            }

            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const result = await bookingHistoryService.getBookingsByUser(
                req.user.id,
                page,
                limit
            );

            res.status(200).json({
                success: true,
                message: 'Bookings retrieved successfully',
                data: result
            });

        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: 'Failed to get bookings',
                error: error.message
            });
        }
    }

    /**
     * Get specific booking by ID
     * GET /bookings/:id
     */
    public async getBookingById(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
                return;
            }

            const { id } = req.params;

            const booking = await bookingHistoryService.getBookingById(id, req.user.id);

            if (!booking) {
                res.status(404).json({
                    success: false,
                    message: 'Booking not found'
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Booking retrieved successfully',
                data: booking
            });

        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: 'Failed to get booking',
                error: error.message
            });
        }
    }

    /**
     * Get booking by confirmation number
     * GET /bookings/confirmation/:number
     */
    public async getBookingByConfirmation(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
                return;
            }

            const { number } = req.params;

            const booking = await bookingHistoryService.getBookingByConfirmation(
                number,
                req.user.id
            );

            if (!booking) {
                res.status(404).json({
                    success: false,
                    message: 'Booking not found'
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Booking retrieved successfully',
                data: booking
            });

        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: 'Failed to get booking',
                error: error.message
            });
        }
    }

    /**
     * Get booking statistics
     * GET /bookings/stats
     */
    public async getBookingStats(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
                return;
            }

            const stats = await bookingHistoryService.getBookingStats(req.user.id);

            res.status(200).json({
                success: true,
                message: 'Booking statistics retrieved successfully',
                data: stats
            });

        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: 'Failed to get booking statistics',
                error: error.message
            });
        }
    }
}

export default new BookingHistoryController();
