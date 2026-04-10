import { Request, Response } from 'express';
import { razorpayInstance } from '../config/razorpay';
import crypto from 'crypto';

export const createOrder = async (req: Request, res: Response): Promise<void> => {
    try {
        const { amount, currency = 'INR', receipt = `receipt_${Date.now()}` } = req.body;

        if (!amount) {
            res.status(400).json({ error: 'Amount is required' });
            return;
        }

        const options = {
            amount: Math.round(amount * 100), // amount in the smallest currency unit (e.g., paise for INR)
            currency,
            receipt,
        };

        const order = await razorpayInstance.orders.create(options);

        res.status(200).json({
            success: true,
            order,
        });
    } catch (error: any) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({
            error: 'Failed to create order',
            details: error.message,
        });
    }
};

export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
             res.status(400).json({ error: 'Missing required Razorpay parameters for verification' });
             return;
        }

        const secret = process.env.RAZORPAY_KEY_SECRET;

        if (!secret) {
            console.error('RAZORPAY_KEY_SECRET is not configured');
            res.status(500).json({ error: 'Server configuration error' });
            return;
        }

        // Create the expected signature
        const generated_signature = crypto
            .createHmac('sha256', secret)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (generated_signature === razorpay_signature) {
            // Payment is successful
            res.status(200).json({
                success: true,
                message: 'Payment has been verified successfully',
            });
        } else {
            // Payment verification failed
            res.status(400).json({
                success: false,
                message: 'Payment verification failed: Validation error',
            });
        }
    } catch (error: any) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
            error: 'Failed to verify payment',
            details: error.message,
        });
    }
};
