import express from 'express';
import orderRoute from './order.routes';
// import paymentRoute from './payment.routes';
import razorpayRoute from './razorpay.routes';


const router = express.Router();

router.use('/order', orderRoute);
// router.use('/payment', paymentRoute);
router.use('/razorpay', razorpayRoute);


export default router;