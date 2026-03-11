import { Request, Response } from 'express';
import { envConfig } from '../config/env';
import { BookingService } from '../services/mybooking.service';
import { AuthServiceClient } from '../clients/authService.client';

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
    private extractTokenFromHeader(req: Request): string | null {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        return authHeader.substring(7);
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
            const token = this.extractTokenFromHeader(req);
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
            const token = this.extractTokenFromHeader(req);
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
            const token = this.extractTokenFromHeader(req);
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
            const token = this.extractTokenFromHeader(req);
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
            const token = this.extractTokenFromHeader(req);
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
            const token = this.extractTokenFromHeader(req);
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
            const token = this.extractTokenFromHeader(req);
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
}