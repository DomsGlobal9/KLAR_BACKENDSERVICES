import express from 'express';
import orderRoute from './order.routes';
import paymentRoute from './payment.routes';


const router = express.Router();

router.use('/order', orderRoute);
router.use('/payment', paymentRoute);

export default router;