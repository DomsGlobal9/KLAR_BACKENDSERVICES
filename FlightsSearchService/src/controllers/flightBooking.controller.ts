import { Request, Response } from 'express';
import { FlightBookingService } from '../services/flightBooking.service';
import { BookingStatus } from '../models/flightBooking.model';
import { getFieldFullForm, getFieldDescription, getValueMeaning } from '../utils/tripjackMappings';
import axios from 'axios';
import { envConfig } from '../config/env';

export class FlightBookingController {
    private service: FlightBookingService;
    private authServiceUrl: string;

    constructor() {
        this.service = new FlightBookingService();
        this.authServiceUrl = envConfig.BASE.AUTH_SERVICE;
    }

    /**
     * Validate token with authentication service
     */
    private async validateToken(token: string): Promise<any> {
        try {
            const response = await axios.post(
                `${this.authServiceUrl}/validate-token`,
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000
                }
            );

            if (response.data.success) {
                return response.data.data;
            }
            throw new Error('Token validation failed');

        } catch (error: any) {
            if (error.response?.data) {
                throw new Error(error.response.data.message || 'Token validation failed');
            }
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Authentication service unavailable');
            }
            throw new Error('Failed to validate token');
        }
    }

    /**
     * Extract token from request headers
     */
    private extractTokenFromHeader(req: Request): string | null {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        return authHeader.substring(7);
    }

    /**
     * Create a new flight booking
     */
    createBooking = async (req: Request, res: Response): Promise<void> => {
        try {

            const token = this.extractTokenFromHeader(req);

            if (!token) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required. Bearer token missing.'
                });
                return;
            }

            let userData: any;

            try {

                userData = await this.validateToken(token);

            } catch (error: any) {
                res.status(401).json({
                    success: false,
                    message: error.message || 'Invalid or expired token'
                });
                return;
            }

            const bookingData = {
                ...req.body,
                userId: userData.id,
                userEmail: userData.email
            };

            console.log("!@!@!@!@!@!@!@!@!@ The booking details we get", JSON.stringify(bookingData, null, 2));

            // const validation = await this.service.validateBookingData(bookingData);
            // if (!validation.valid) {
            //     res.status(400).json({
            //         success: false,
            //         message: 'Validation failed',
            //         errors: validation.errors
            //     });
            //     return;
            // }

            const booking = await this.service.createBooking(bookingData);

            res.status(201).json({
                success: true,
                message: 'Booking created successfully',
                data: booking
            });
        } catch (error: any) {
            console.error('Create booking error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to create booking'
            });
        }
    };

    /**
     * Get booking by ID
     */
    getBookingById = async (req: Request, res: Response): Promise<void> => {
        try {

            const token = this.extractTokenFromHeader(req);
            if (!token) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required. Bearer token missing.'
                });
                return;
            }


            let userData: any;
            try {
                userData = await this.validateToken(token);
            } catch (error: any) {
                res.status(401).json({
                    success: false,
                    message: error.message || 'Invalid or expired token'
                });
                return;
            }

            const { id } = req.params;

            const booking = await this.service.getBookingById(id);

            if (!booking) {
                res.status(404).json({
                    success: false,
                    message: 'Booking not found'
                });
                return;
            }


            if (booking.userId !== userData.userId) {
                res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
                return;
            }

            res.status(200).json({
                success: true,
                data: booking
            });
        } catch (error: any) {
            console.error('Get booking by ID error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch booking'
            });
        }
    };

    /**
     * Get booking by Tripjack booking ID
     */
    getBookingByBookingId = async (req: Request, res: Response): Promise<void> => {
        try {

            const token = this.extractTokenFromHeader(req);
            if (!token) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required. Bearer token missing.'
                });
                return;
            }


            let userData: any;
            try {
                userData = await this.validateToken(token);
            } catch (error: any) {
                res.status(401).json({
                    success: false,
                    message: error.message || 'Invalid or expired token'
                });
                return;
            }

            const { bookingId } = req.params;

            const booking = await this.service.getBookingByBookingId(bookingId);

            if (!booking) {
                res.status(404).json({
                    success: false,
                    message: 'Booking not found'
                });
                return;
            }


            if (booking.userId !== userData.userId) {
                res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
                return;
            }

            res.status(200).json({
                success: true,
                data: booking
            });
        } catch (error: any) {
            console.error('Get booking by Tripjack ID error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch booking'
            });
        }
    };

    /**
     * Get user's bookings
     */
    getUserBookings = async (req: Request, res: Response): Promise<void> => {
        try {

            const token = this.extractTokenFromHeader(req);
            if (!token) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required. Bearer token missing.'
                });
                return;
            }


            let userData: any;
            try {
                userData = await this.validateToken(token);
            } catch (error: any) {
                res.status(401).json({
                    success: false,
                    message: error.message || 'Invalid or expired token'
                });
                return;
            }

            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const result = await this.service.getUserBookings(userData.userId, page, limit);

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: {
                    page,
                    limit,
                    total: result.total,
                    pages: Math.ceil(result.total / limit)
                }
            });
        } catch (error: any) {
            console.error('Get user bookings error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch bookings'
            });
        }
    };

    /**
     * Update booking status
     */
    updateBookingStatus = async (req: Request, res: Response): Promise<void> => {
        try {

            const token = this.extractTokenFromHeader(req);
            if (!token) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required. Bearer token missing.'
                });
                return;
            }


            let userData: any;
            try {
                userData = await this.validateToken(token);
            } catch (error: any) {
                res.status(401).json({
                    success: false,
                    message: error.message || 'Invalid or expired token'
                });
                return;
            }

            const { id } = req.params;
            const { status, failureReason } = req.body;

            const booking = await this.service.getBookingById(id);

            if (!booking) {
                res.status(404).json({
                    success: false,
                    message: 'Booking not found'
                });
                return;
            }


            if (booking.userId !== userData.userId) {
                res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
                return;
            }

            const updatedBooking = await this.service.updateBookingStatus(id, {
                status,
                failureReason
            });

            res.status(200).json({
                success: true,
                message: `Booking status updated to ${status}`,
                data: updatedBooking
            });
        } catch (error: any) {
            console.error('Update booking status error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to update booking status'
            });
        }
    };

    /**
     * Confirm booking
     */
    confirmBooking = async (req: Request, res: Response): Promise<void> => {
        try {

            const token = this.extractTokenFromHeader(req);
            if (!token) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required. Bearer token missing.'
                });
                return;
            }


            let userData: any;
            try {
                userData = await this.validateToken(token);
            } catch (error: any) {
                res.status(401).json({
                    success: false,
                    message: error.message || 'Invalid or expired token'
                });
                return;
            }

            const { bookingId } = req.params;

            const booking = await this.service.getBookingByBookingId(bookingId);

            if (!booking) {
                res.status(404).json({
                    success: false,
                    message: 'Booking not found'
                });
                return;
            }


            if (booking.userId !== userData.userId) {
                res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
                return;
            }

            const confirmedBooking = await this.service.confirmBooking(bookingId);

            res.status(200).json({
                success: true,
                message: 'Booking confirmed successfully',
                data: confirmedBooking
            });
        } catch (error: any) {
            console.error('Confirm booking error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to confirm booking'
            });
        }
    };

    /**
     * Cancel booking
     */
    cancelBooking = async (req: Request, res: Response): Promise<void> => {
        try {

            const token = this.extractTokenFromHeader(req);
            if (!token) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required. Bearer token missing.'
                });
                return;
            }


            let userData: any;
            try {
                userData = await this.validateToken(token);
            } catch (error: any) {
                res.status(401).json({
                    success: false,
                    message: error.message || 'Invalid or expired token'
                });
                return;
            }

            const { bookingId } = req.params;
            const { reason } = req.body;

            const booking = await this.service.getBookingByBookingId(bookingId);

            if (!booking) {
                res.status(404).json({
                    success: false,
                    message: 'Booking not found'
                });
                return;
            }


            if (booking.userId !== userData.userId) {
                res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
                return;
            }

            const cancelledBooking = await this.service.cancelBooking(bookingId, reason);

            res.status(200).json({
                success: true,
                message: 'Booking cancelled successfully',
                data: cancelledBooking
            });
        } catch (error: any) {
            console.error('Cancel booking error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to cancel booking'
            });
        }
    };

    /**
     * Get booking statistics
     */
    getBookingStats = async (req: Request, res: Response): Promise<void> => {
        try {

            const token = this.extractTokenFromHeader(req);
            if (!token) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required. Bearer token missing.'
                });
                return;
            }


            let userData: any;
            try {
                userData = await this.validateToken(token);
            } catch (error: any) {
                res.status(401).json({
                    success: false,
                    message: error.message || 'Invalid or expired token'
                });
                return;
            }

            const stats = await this.service.getBookingStats(userData.userId);

            res.status(200).json({
                success: true,
                data: stats
            });
        } catch (error: any) {
            console.error('Get booking stats error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch booking statistics'
            });
        }
    };
}