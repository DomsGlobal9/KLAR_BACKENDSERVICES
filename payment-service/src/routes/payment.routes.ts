import { Router } from 'express';
import { createOrder, verifyPayment } from '../controllers/payment.controller';

const router = Router();

// Route to create a new Razorpay order
router.post('/create-order', createOrder);

// Route to verify the payment signature after client-side payment
router.post('/verify', verifyPayment);

export default router;
