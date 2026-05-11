import { Request, Response } from 'express';
import {
    createRazorpayOrderService,
    verifyRazorpayPaymentService,
    getRazorpayOrderService,
    syncRazorpayOrderStatusService,
    getRazorpayPaymentStatusService,
    getRazorpayOrderDetailsService,
    razorpayWebhookService
} from '../services/razorpay.service';

import {
    validateCreateOrder,
    validateVerifyPayment,
    validateOrderIdParam,
    validatePaymentIdParam,
    validateRazorpayOrderIdParam
} from '../utils/validator/razorpay.validation';

export const createRazorpayOrderController = async (req: Request, res: Response) => {
    try {
        const error = validateCreateOrder(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const { userId, userEmail, mobile, clientType, amount, currency = 'INR' } = req.body;

        const result = await createRazorpayOrderService({
            userId,
            userEmail,
            mobile,
            clientType,
            amount,
            currency
        });

        return res.status(200).json({
            success: true,
            message: 'Razorpay order created successfully',
            data: result,
        });
    } catch (error: any) {
        console.error('Create Razorpay order controller error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to create Razorpay order',
        });
    }
};

export const verifyRazorpayPaymentController = async (req: Request, res: Response) => {
    try {
        const error = validateVerifyPayment(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const result = await verifyRazorpayPaymentService(req.body);

        return res.status(200).json({
            success: true,
            message: 'Payment verified successfully',
            data: result,
        });
    } catch (error: any) {
        console.error('Verify Razorpay payment controller error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to verify payment',
        });
    }
};

export const getRazorpayOrderController = async (req: Request, res: Response) => {
    try {
        const error = validateOrderIdParam(req.params.orderId as string);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const order = await getRazorpayOrderService(req.params.orderId as string);

        return res.status(200).json({
            success: true,
            data: order,
        });
    } catch (error: any) {
        console.error('Get Razorpay order controller error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch order',
        });
    }
};

export const syncRazorpayOrderStatusController = async (req: Request, res: Response) => {
    try {
        const error = validateOrderIdParam(req.params.orderId as string);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const updatedOrder = await syncRazorpayOrderStatusService(req.params.orderId as string);

        return res.status(200).json({
            success: true,
            message: 'Order status synced successfully',
            data: updatedOrder,
        });
    } catch (error: any) {
        console.error('Sync Razorpay order status controller error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to sync order status',
        });
    }
};

export const getRazorpayPaymentStatusController = async (req: Request, res: Response) => {
    try {
        const error = validatePaymentIdParam(req.params.paymentId as string);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const paymentStatus = await getRazorpayPaymentStatusService(req.params.paymentId as string);

        return res.status(200).json({
            success: true,
            data: paymentStatus,
        });
    } catch (error: any) {
        console.error('Get Razorpay payment status controller error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch payment status',
        });
    }
};

export const getRazorpayOrderDetailsController = async (req: Request, res: Response) => {
    try {
        const error = validateRazorpayOrderIdParam(req.params.razorpayOrderId as string);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const orderDetails = await getRazorpayOrderDetailsService(req.params.razorpayOrderId as string);

        return res.status(200).json({
            success: true,
            data: orderDetails,
        });
    } catch (error: any) {
        console.error('Get Razorpay order details controller error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch order details',
        });
    }
};

export const razorpayWebhookController = async (
    req: Request,
    res: Response
) => {
    try {

        const signature = req.headers[
            'x-razorpay-signature'
        ] as string;

        const rawBody = req.body;

        await razorpayWebhookService(
            rawBody,
            signature
        );

        return res.status(200).json({
            success: true,
            message: 'Webhook processed successfully'
        });

    } catch (error: any) {

        console.error(
            'Razorpay webhook controller error:',
            error
        );

        return res.status(400).json({
            success: false,
            message: error.message || 'Webhook failed'
        });
    }
};