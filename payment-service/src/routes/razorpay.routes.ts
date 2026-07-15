import express from 'express';
import {
    createRazorpayOrderController,
    verifyRazorpayPaymentController,
    getRazorpayOrderController,
    syncRazorpayOrderStatusController,
    getRazorpayPaymentStatusController,
    getRazorpayOrderDetailsController,
    razorpayWebhookController,
    refundRazorpayPaymentController,
    verifyPaymentInternalController,
    testWebhookController
} from '../controllers/razorpay.controller';
import { internalServiceAuth } from '../middlewares/internalService.middleware';

const router = express.Router();

/**
 * Refund a captured payment. Called by booking services, not by the browser.
 * POST /api/razorpay/internal/refund
 */
router.post('/internal/refund', internalServiceAuth, refundRazorpayPaymentController);

/**
 * Verify a captured payment before a booking is committed. Called by booking
 * services, not by the browser.
 * POST /api/razorpay/internal/verify
 */
router.post('/internal/verify', internalServiceAuth, verifyPaymentInternalController);

/**
 * Create a new Razorpay order
 * POST /api/razorpay/create-order
 */
router.post('/create-order', createRazorpayOrderController);

/**
 * Verify Razorpay payment after frontend payment completion
 * POST /api/razorpay/verify-payment
 */
router.post('/verify-payment', verifyRazorpayPaymentController);

/**
 * Razorpay webhook endpoint
 * POST /api/razorpay/webhook
 */
router.post('/webhook', razorpayWebhookController);

/**
 * Get order details by our orderId
 * GET /api/razorpay/order/:orderId
 */
router.get('/order/:orderId', getRazorpayOrderController);

/**
 * Sync order status with Razorpay (manual sync)
 * POST /api/razorpay/sync-order/:orderId
 */
router.post('/sync-order/:orderId', syncRazorpayOrderStatusController);

/**
 * Get payment status by Razorpay paymentId
 * GET /api/razorpay/payment-status/:paymentId
 */
router.get('/payment-status/:paymentId', getRazorpayPaymentStatusController);

/**
 * Get Razorpay order details by Razorpay orderId
 * GET /api/razorpay/razorpay-order/:razorpayOrderId
 */
router.get('/razorpay-order/:razorpayOrderId', getRazorpayOrderDetailsController);


router.post('/test-webhook', testWebhookController);

export default router;