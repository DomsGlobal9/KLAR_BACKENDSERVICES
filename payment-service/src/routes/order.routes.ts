import express from 'express';
import {
    createOrderController,
    getOrderController,
    getPaymentStatusController,
    syncOrderStatusController
} from '../controllers/order.controller';

const router = express.Router();

/**
 * Get payment status by orderId
*/
router.get('/payment-status/:orderId/abc', getPaymentStatusController);

/**
 * Get order details by orderId
*/
router.get('/details/:orderId/abc', getOrderController);

/**
 * Create new order
*/
router.post('/create-order', createOrderController);


/**
 * Sync order status with Cashfree (manual sync)
*/
router.post('/sync-order/:orderId', syncOrderStatusController);


export default router;