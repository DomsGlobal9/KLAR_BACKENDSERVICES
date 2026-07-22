import express from 'express';
import {
    createRefundController,
    getRefundByRefundIdController,
    getRefundsByPaymentIdController,
    getRefundsByOrderIdController,
    updateRefundStatusController,
    getRefundByRazorpayRefundIdController,
    getAllRefundsByUserIdController,
    fetchRefundFromRazorpayController,
    fetchAllRefundsFromRazorpayController,
    updateRefundNotesController,
    createRefundByBookingIdController
} from '../controllers/razorpayRefund.controller';

const router = express.Router();

router.post('/', createRefundController);

router.post('/bookingId', createRefundByBookingIdController);



router.get('/:refundId', getRefundByRefundIdController);

router.get('/payment/:paymentId', getRefundsByPaymentIdController);

router.get('/order/:orderId', getRefundsByOrderIdController);

router.put('/:refundId/status', updateRefundStatusController);

router.get('/razorpay/:razorpayRefundId', getRefundByRazorpayRefundIdController);

router.get('/user/:userId', getAllRefundsByUserIdController);

router.get('/razorpay/refund/:refundId', fetchRefundFromRazorpayController);

router.get('/razorpay/all', fetchAllRefundsFromRazorpayController);

router.patch('/:refundId/notes', updateRefundNotesController);

export default router;