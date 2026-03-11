
import { Router } from 'express';
import { BookingController } from '../controllers/myBooking.controller';

const router = Router();
const bookingController = new BookingController();

/*
 * GET /api/bookings - Get all bookings with pagination (descending order by default)
 */
router.get('/', bookingController.getAllBookings);

/*
 * GET /api/bookings/user - Get current user's bookings
 */
router.get('/user', bookingController.getUserBookings);

/*
 * GET /api/bookings/recent - Get recent bookings for current user
 */
router.get('/recent', bookingController.getUserRecentBookings);

/*
 * GET /api/bookings/status/:status - Get bookings by status
 */
router.get('/status/:status', bookingController.getBookingsByStatus);

/*
 * GET /api/bookings/stats - Get booking statistics for current user
 */
router.get('/stats', bookingController.getBookingStats);

/*
 * GET /api/bookings/tripjack/:bookingId - Get booking by TripJack booking ID
 */
router.get('/tripjack/:bookingId', bookingController.getBookingByBookingId);

/*
 * GET /api/bookings/:id - Get booking by MongoDB ID
 */
router.get('/:id', bookingController.getBookingById);

/*
 * PUT /api/bookings/:id - Update booking details
 */
router.put('/:id', bookingController.updateBooking);


// *******************************
// Cancellation Amendment Section*
// *******************************

/*
 * GET /api/bookings/tripjack/:bookingId/cancellation/charges - Get cancellation charges
 */
router.get('/tripjack/:bookingId/cancellation/charges', bookingController.getCancellationCharges);

/*
 * POST /api/bookings/tripjack/:bookingId/cancellation - Submit cancellation
 */
router.post('/tripjack/:bookingId/cancellation', bookingController.submitCancellation);

/*
 * GET /api/bookings/amendments/:amendmentId - Get amendment details
 */
router.get('/amendments/:amendmentId', bookingController.getAmendmentDetails);

/*
 * POST /api/bookings/tripjack/:bookingId/cancellation/complete - Complete cancellation flow (charges + submit + poll)
 */
router.post('/tripjack/:bookingId/cancellation/complete', bookingController.completeCancellation);

export default router;
