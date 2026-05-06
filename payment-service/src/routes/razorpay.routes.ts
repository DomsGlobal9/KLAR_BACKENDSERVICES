import express from 'express';
import {
    createRazorpayOrderController,
    verifyRazorpayPaymentController,
    getRazorpayOrderController,
    syncRazorpayOrderStatusController,
    getRazorpayPaymentStatusController,
    getRazorpayOrderDetailsController
} from '../controllers/razorpay.controller';

const router = express.Router();

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

export default router;