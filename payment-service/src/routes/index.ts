import express from 'express';
import orderRoute from './order.routes';
// import paymentRoute from './payment.routes';
import razorpayRoute from './razorpay.routes';
import razorpayRefundRoute from './razorpayRefund.routes';


const router = express.Router();

router.use('/order', orderRoute);
// router.use('/payment', paymentRoute);
router.use('/razorpay/refund', razorpayRefundRoute);
router.use('/razorpay', razorpayRoute);


export default router;