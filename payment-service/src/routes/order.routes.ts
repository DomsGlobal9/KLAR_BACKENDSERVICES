import express from 'express';
import {
    createOrderController,
    getOrderController,
    getPaymentStatusController,
    syncOrderStatusController
} from '../controllers/order.controller';

const router = express.Router();

/**
 * Create new order
 * POST /api/orders/create-order
 */
router.post('/create-order', createOrderController);

/**
 * Sync order status with Cashfree (manual sync)
 * POST /api/orders/sync-order/:orderId
 */
router.post('/sync-order/:orderId', syncOrderStatusController);

/**
 * Get payment status by orderId
 * GET /api/orders/payment-status/:orderId
 */
router.get('/payment-status/:orderId', getPaymentStatusController);

/**
 * Get order details by orderId
 * GET /api/orders/details/:orderId
 */
router.get('/details/:orderId', getOrderController);

export default router;