import { Router } from 'express';
import { FlightBookingController } from '../controllers/flightBooking.controller';

const router = Router();
const controller = new FlightBookingController();

/**
 * @route   POST /api/flight-bookings
 * @desc    Create a new flight booking
 * @access  Private
 * @body    {
 *            "bookingId": "TJS103501996017",
 *            "paymentInfos": [{"amount": 303096.00}],
 *            "travellerInfo": [...],
 *            "gstInfo": {...},
 *            "deliveryInfo": {...}
 *          }
 */
router.post('/', controller.createBooking);

/**
 * @route   GET /api/flight-bookings/:id
 * @desc    Get booking by MongoDB ID
 * @access  Private
 */
router.get('/:id', controller.getBookingById);

/**
 * @route   GET /api/flight-bookings/tripjack/:bookingId
 * @desc    Get booking by Tripjack booking ID
 * @access  Private
 */
router.get('/tripjack/:bookingId', controller.getBookingByBookingId);

/**
 * @route   GET /api/flight-bookings/user/my-bookings
 * @desc    Get all bookings for authenticated user
 * @access  Private
 * @query   page, limit
 */
router.get('/user/my-bookings', controller.getUserBookings);

/**
 * @route   PATCH /api/flight-bookings/:id/status
 * @desc    Update booking status
 * @access  Private
 * @body    { "status": "CONFIRMED", "failureReason": "optional" }
 */
router.patch('/:id/status', controller.updateBookingStatus);

/**
 * @route   POST /api/flight-bookings/:bookingId/confirm
 * @desc    Confirm a booking
 * @access  Private
 */
router.post('/:bookingId/confirm', controller.confirmBooking);

/**
 * @route   POST /api/flight-bookings/:bookingId/cancel
 * @desc    Cancel a booking
 * @access  Private
 * @body    { "reason": "optional cancellation reason" }
 */
router.post('/:bookingId/cancel', controller.cancelBooking);

/**
 * @route   GET /api/flight-bookings/stats/summary
 * @desc    Get booking statistics for authenticated user
 * @access  Private
 */
router.get('/stats/summary', controller.getBookingStats);

export default router;