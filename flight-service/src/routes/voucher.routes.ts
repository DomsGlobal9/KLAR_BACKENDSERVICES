import { Router } from "express";
import VoucherController from "../controllers/voucher.controller";

const router = Router();

// ==================== Voucher Routes ====================

/**
 * @route   GET /api/voucher/:bookingId/download
 * @desc    Download voucher as PDF attachment
 * @access  Private (requires authentication)
 */
router.get("/:bookingId/download", VoucherController.downloadVoucher);

/**
 * @route   GET /api/voucher/:bookingId/preview
 * @desc    Preview voucher in browser
 * @access  Private (requires authentication)
 */
router.get("/:bookingId/preview", VoucherController.previewVoucher);

/**
 * @route   GET /api/voucher/:bookingId/base64
 * @desc    Get voucher as base64 string
 * @access  Private (requires authentication)
 */
router.get("/:bookingId/base64", VoucherController.getVoucherBase64);

/**
 * @route   POST /api/voucher/:bookingId/email
 * @desc    Send voucher via email
 * @access  Private (requires authentication)
 */
router.post("/:bookingId/email", VoucherController.emailVoucher);

export default router;