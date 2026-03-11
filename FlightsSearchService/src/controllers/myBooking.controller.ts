import { Request, Response } from 'express';
import { envConfig } from '../config/env';
import { BookingService } from '../services/mybooking.service';
import { AuthServiceClient } from '../clients/authService.client';
import { cancelBooking, getAmendmentDetails, getCancellationCharges, retrieveBookingFromTripJack, retrieveBookingFull, retrieveBookingMinimal, submitCancellation } from '../services/tripjackService';


export class BookingController {

    private bookingService: BookingService;
    private authService: AuthServiceClient;

    constructor() {
        this.bookingService = new BookingService();
        this.authService = AuthServiceClient.getInstance(envConfig.BASE.AUTH_SERVICE);
    }

    /**
     * Extract token from request headers
     */
    private extractToken(req: Request): string | null {

        if (req.cookies?.token) {
            return req.cookies.token;
        }

        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        return null;
    }

    /**
     * Validate token and get user details
     */
    private async validateToken(token: string): Promise<any> {
        try {
            return await this.authService.validateToken(token);
        } catch (error: any) {
            throw new Error(error.message || 'Token validation failed');
        }
    }

    /**
     * Get booking by MongoDB ID
     */
    getBookingById = async (req: Request, res: Response): Promise<void> => {
        try {
            // Extract and validate token
            const token = this.extractToken(req);
            if (!token) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required. Bearer token missing.'
                });
                return;
            }

            // Validate token and get user data
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

            if (!id) {
                res.status(400).json({
                    success: false,
                    message: 'Booking ID is required'
                });
                return;
            }

            const booking = await this.bookingService.getBookingById(id);

            if (!booking) {
                res.status(404).json({
                    success: false,
                    message: 'Booking not found'
                });
                return;
            }

            // Check if user has access to this booking
            if (booking.userId !== userData.id && userData.role !== 'ADMIN') {
                res.status(403).json({
                    success: false,
                    message: 'Access denied. You do not have permission to view this booking.'
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Booking fetched successfully',
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
     * Get booking by TripJack booking ID
     */
    getBookingByBookingId = async (req: Request, res: Response): Promise<void> => {
        try {
            // Extract and validate token
            const token = this.extractToken(req);
            if (!token) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required. Bearer token missing.'
                });
                return;
            }

            // Validate token and get user data
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

            if (!bookingId) {
                res.status(400).json({
                    success: false,
                    message: 'Booking ID is required'
                });
                return;
            }

            const booking = await this.bookingService.getBookingByBookingId(bookingId);

            if (!booking) {
                res.status(404).json({
                    success: false,
                    message: 'Booking not found'
                });
                return;
            }

            // Check if user has access to this booking
            if (booking.userId !== userData.id && userData.role !== 'ADMIN') {
                res.status(403).json({
                    success: false,
                    message: 'Access denied. You do not have permission to view this booking.'
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Booking fetched successfully',
                data: booking
            });
        } catch (error: any) {
            console.error('Get booking by TripJack ID error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch booking'
            });
        }
    };

    /**
     * Get all bookings with pagination and filters (descending order)
     */
    getAllBookings = async (req: Request, res: Response): Promise<void> => {
        try {
            // Extract and validate token
            const token = this.extractToken(req);
            if (!token) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required. Bearer token missing.'
                });
                return;
            }

            // Validate token and get user data
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

            // Parse query parameters
            const queryParams = {
                page: req.query.page ? Number(req.query.page) : 1,
                limit: req.query.limit ? Number(req.query.limit) : 10,
                status: req.query.status as string,
                startDate: req.query.startDate as string,
                endDate: req.query.endDate as string,
                userId: req.query.userId as string,
                sortBy: (req.query.sortBy as string) || 'createdAt',
                sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc'
            };

            // If user is not admin, only show their own bookings
            const requestingUserId = userData.role !== 'ADMIN' ? userData.id : undefined;

            const result = await this.bookingService.getAllBookings(queryParams, requestingUserId);

            res.status(200).json({
                success: true,
                message: 'Bookings fetched successfully',
                data: {
                    bookings: result.bookings,
                    pagination: result.pagination
                }
            });
        } catch (error: any) {
            console.error('Get all bookings error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch bookings'
            });
        }
    };

    /**
     * Get user's bookings
     */
    getUserBookings = async (req: Request, res: Response): Promise<void> => {
        try {
            // Extract and validate token
            const token = this.extractToken(req);
            if (!token) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required. Bearer token missing.'
                });
                return;
            }

            // Validate token and get user data
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

            const result = await this.bookingService.getUserBookings(userData.id, page, limit);

            res.status(200).json({
                success: true,
                message: 'User bookings fetched successfully',
                data: {
                    bookings: result.data,
                    pagination: {
                        currentPage: page,
                        itemsPerPage: limit,
                        totalItems: result.total,
                        totalPages: Math.ceil(result.total / limit),
                        hasNextPage: page < Math.ceil(result.total / limit),
                        hasPrevPage: page > 1
                    }
                }
            });
        } catch (error: any) {
            console.error('Get user bookings error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch user bookings'
            });
        }
    };

    /**
     * Get recent bookings for user
     */
    getUserRecentBookings = async (req: Request, res: Response): Promise<void> => {
        try {
            // Extract and validate token
            const token = this.extractToken(req);
            if (!token) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required. Bearer token missing.'
                });
                return;
            }

            // Validate token and get user data
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

            const limit = req.query.limit ? Number(req.query.limit) : 5;

            const bookings = await this.bookingService.getUserRecentBookings(userData.id, limit);

            res.status(200).json({
                success: true,
                message: 'Recent bookings fetched successfully',
                data: bookings
            });
        } catch (error: any) {
            console.error('Get user recent bookings error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch recent bookings'
            });
        }
    };

    /**
     * Get bookings by status
     */
    getBookingsByStatus = async (req: Request, res: Response): Promise<void> => {
        try {
            // Extract and validate token
            const token = this.extractToken(req);
            if (!token) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required. Bearer token missing.'
                });
                return;
            }

            // Validate token and get user data
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

            const { status } = req.params;
            const limit = req.query.limit ? Number(req.query.limit) : 50;

            if (!status) {
                res.status(400).json({
                    success: false,
                    message: 'Status is required'
                });
                return;
            }

            const bookings = await this.bookingService.getBookingsByStatus(status, limit);

            // If user is not admin, filter to only show their bookings
            const filteredBookings = userData.role !== 'ADMIN'
                ? bookings.filter(booking => booking.userId === userData.id)
                : bookings;

            res.status(200).json({
                success: true,
                message: `Bookings with status ${status} fetched successfully`,
                data: filteredBookings
            });
        } catch (error: any) {
            console.error('Get bookings by status error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch bookings by status'
            });
        }
    };

    /**
     * Get booking statistics
     */
    getBookingStats = async (req: Request, res: Response): Promise<void> => {
        try {
            // Extract and validate token
            const token = this.extractToken(req);
            if (!token) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required. Bearer token missing.'
                });
                return;
            }

            // Validate token and get user data
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

            const stats = await this.bookingService.getBookingStats(userData.id);

            res.status(200).json({
                success: true,
                message: 'Booking statistics fetched successfully',
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

    /**
     * Update booking details
     */
    updateBooking = async (req: Request, res: Response): Promise<void> => {
        try {
            // Extract and validate token
            const token = this.extractToken(req);
            if (!token) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required. Bearer token missing.'
                });
                return;
            }

            // Validate token and get user data
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
            const updateData = req.body;

            if (!id) {
                res.status(400).json({
                    success: false,
                    message: 'Booking ID is required'
                });
                return;
            }

            // Check if user has access to update this booking
            const existingBooking = await this.bookingService.getBookingById(id);
            if (!existingBooking) {
                res.status(404).json({
                    success: false,
                    message: 'Booking not found'
                });
                return;
            }

            if (existingBooking.userId !== userData.id && userData.role !== 'ADMIN') {
                res.status(403).json({
                    success: false,
                    message: 'Access denied. You do not have permission to update this booking.'
                });
                return;
            }

            const updatedBooking = await this.bookingService.updateBooking(id, updateData);

            res.status(200).json({
                success: true,
                message: 'Booking updated successfully',
                data: updatedBooking
            });
        } catch (error: any) {
            console.error('Update booking error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to update booking'
            });
        }
    };

    /**
     * Retrieve booking from TripJack by booking ID
     */
    retrieveFromTripJack = async (req: Request, res: Response): Promise<void> => {
        try {
            // Extract and validate token
            const token = this.extractToken(req);
            if (!token) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required. Bearer token missing.'
                });
                return;
            }

            // Validate token and get user data
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
            const { fullDetails } = req.query; // ?fullDetails=true for full data, false for minimal

            if (!bookingId) {
                res.status(400).json({
                    success: false,
                    message: 'TripJack Booking ID is required'
                });
                return;
            }

            // Check if booking exists in our database and verify access
            const existingBooking = await this.bookingService.getBookingByBookingId(bookingId);

            if (existingBooking) {
                // Verify user has access to this booking
                if (existingBooking.userId !== userData.id && userData.role !== 'ADMIN') {
                    res.status(403).json({
                        success: false,
                        message: 'Access denied. You do not have permission to view this booking.'
                    });
                    return;
                }
            } else {
                // If booking doesn't exist in our DB, only admins can retrieve from TripJack
                if (userData.role !== 'ADMIN') {
                    res.status(403).json({
                        success: false,
                        message: 'Access denied. Booking not found in your account.'
                    });
                    return;
                }
            }

            // Retrieve from TripJack based on query parameter
            let tripJackData;
            if (fullDetails === 'true') {
                tripJackData = await retrieveBookingFull(bookingId);
            } else if (fullDetails === 'false') {
                tripJackData = await retrieveBookingMinimal(bookingId);
            } else {
                // Default to full details if not specified
                tripJackData = await retrieveBookingFromTripJack(bookingId, true);
            }

            res.status(200).json({
                success: true,
                message: 'Booking retrieved from TripJack successfully',
                data: tripJackData
            });
        } catch (error: any) {
            console.error('Retrieve from TripJack error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to retrieve booking from TripJack'
            });
        }
    };

    /**
     * Sync booking from TripJack to local database
     */
    syncBookingFromTripJack = async (req: Request, res: Response): Promise<void> => {
        try {
            const token = this.extractToken(req);
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

            if (userData.role !== 'ADMIN') {
                res.status(403).json({
                    success: false,
                    message: 'Access denied. Only admins can sync bookings.'
                });
                return;
            }

            const { bookingId } = req.params;
            const { fullDetails } = req.query;

            if (!bookingId) {
                res.status(400).json({
                    success: false,
                    message: 'TripJack Booking ID is required'
                });
                return;
            }

            const requirePaxPricing = fullDetails !== 'false';
            const tripJackData = await retrieveBookingFromTripJack(bookingId, requirePaxPricing);

            res.status(200).json({
                success: true,
                message: 'Booking synced from TripJack successfully',
                data: tripJackData
            });
        } catch (error: any) {
            console.error('Sync booking from TripJack error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to sync booking from TripJack'
            });
        }
    };

    /**
     * Get cancellation charges
     */
    getCancellationCharges = async (req: Request, res: Response): Promise<void> => {
        try {

            const token = this.extractToken(req);
            if (!token) {
                res.status(401).json({ success: false, message: 'Authentication required' });
                return;
            }

            const userData = await this.validateToken(token);
            const { bookingId } = req.params;
            const { remarks, trips } = req.body;

            if (!bookingId) {
                res.status(400).json({ success: false, message: 'Booking ID is required' });
                return;
            }


            const booking = await this.bookingService.getBookingByBookingId(bookingId);
            if (!booking) {
                res.status(404).json({ success: false, message: 'Booking not found' });
                return;
            }

            if (booking.userId !== userData.id && userData.role !== 'ADMIN') {
                res.status(403).json({ success: false, message: 'Access denied' });
                return;
            }

            const charges = await getCancellationCharges(bookingId, remarks || 'Cancellation request', trips);

            res.status(200).json({
                success: true,
                message: 'Cancellation charges fetched successfully',
                data: charges
            });
        } catch (error: any) {
            console.error('Get cancellation charges error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch cancellation charges'
            });
        }
    };

    /**
     * Submit cancellation
     */
    submitCancellation = async (req: Request, res: Response): Promise<void> => {
        try {

            const token = this.extractToken(req);
            if (!token) {
                res.status(401).json({ success: false, message: 'Authentication required' });
                return;
            }

            const userData = await this.validateToken(token);
            const { bookingId } = req.params;
            const { remarks, trips } = req.body;

            if (!bookingId) {
                res.status(400).json({ success: false, message: 'Booking ID is required' });
                return;
            }


            if (userData.role !== 'ADMIN') {
                res.status(403).json({ success: false, message: 'Access denied. Only admins can cancel bookings.' });
                return;
            }

            const result = await submitCancellation(bookingId, remarks || 'Cancellation request', trips);

            res.status(200).json({
                success: true,
                message: 'Cancellation submitted successfully',
                data: result
            });
        } catch (error: any) {
            console.error('Submit cancellation error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to submit cancellation'
            });
        }
    };

    /**
     * Get amendment details
     */
    getAmendmentDetails = async (req: Request, res: Response): Promise<void> => {
        try {

            const token = this.extractToken(req);
            if (!token) {
                res.status(401).json({ success: false, message: 'Authentication required' });
                return;
            }

            const userData = await this.validateToken(token);
            const { amendmentId } = req.params;

            if (!amendmentId) {
                res.status(400).json({ success: false, message: 'Amendment ID is required' });
                return;
            }


            if (userData.role !== 'ADMIN') {
                res.status(403).json({ success: false, message: 'Access denied' });
                return;
            }

            const details = await getAmendmentDetails(amendmentId);

            res.status(200).json({
                success: true,
                message: 'Amendment details fetched successfully',
                data: details
            });
        } catch (error: any) {
            console.error('Get amendment details error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch amendment details'
            });
        }
    };

    /**
     * Complete cancellation flow (charges + submit + poll)
     */
    completeCancellation = async (req: Request, res: Response): Promise<void> => {
        try {

            const token = this.extractToken(req);
            if (!token) {
                res.status(401).json({ success: false, message: 'Authentication required' });
                return;
            }

            const userData = await this.validateToken(token);
            const { bookingId } = req.params;
            const { remarks, trips } = req.body;

            if (!bookingId) {
                res.status(400).json({ success: false, message: 'Booking ID is required' });
                return;
            }


            if (userData.role !== 'ADMIN') {
                res.status(403).json({ success: false, message: 'Access denied. Only admins can cancel bookings.' });
                return;
            }


            const booking = await this.bookingService.getBookingByBookingId(bookingId);
            if (!booking) {
                res.status(404).json({ success: false, message: 'Booking not found' });
                return;
            }

            const result = await cancelBooking(
                bookingId,
                remarks || 'Cancellation request',
                trips,
                10000,
                5,
            );

            if (result.success) {
                await this.bookingService.updateBookingStatus(booking._id.toString(), {
                    status: 'CANCELLED',
                    failureReason: `Cancelled with refund: ${result.refundAmount}`
                });
            }

            res.status(200).json({
                success: result.success,
                message: result.success ? 'Booking cancelled successfully' : 'Cancellation processing',
                data: result
            });
        } catch (error: any) {
            console.error('Complete cancellation error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to process cancellation'
            });
        }
    };
}