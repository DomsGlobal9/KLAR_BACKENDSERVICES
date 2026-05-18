import { Router } from "express";
import AgencyBookingController from "../controllers/agency-booking.controller";

const router = Router();

/**
 * @route   GET /api/agency/booking/confirmation-pdf/:bookingId
 * @desc    Generate and download the internal agency flight confirmation PDF with markup details
 * @access  Private/Agency-Only
 */
router.get("/confirmation-pdf/:bookingId", AgencyBookingController.getAgencyConfirmationPdf);

export default router;