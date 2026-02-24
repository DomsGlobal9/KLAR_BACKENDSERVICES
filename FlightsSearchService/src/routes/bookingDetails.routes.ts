import express from 'express';
import {
    storeUserDetails,
    updateBookingId,
    handleFailedBooking,
    getBookingDetailsByPriceId,
    getBookingDetailsByBookingId
} from '../controllers/bookingDetails.controller';

const router = express.Router();

// Store user details (Step 1)
router.post('/store-details', storeUserDetails);

// Update with booking ID (Step 2)
router.put('/update-booking-id', updateBookingId);

// Handle failed booking
router.post('/handle-failure', handleFailedBooking);

// Get booking details
router.get('/by-price/:priceId', getBookingDetailsByPriceId);
router.get('/by-booking/:bookingId', getBookingDetailsByBookingId);

export default router;