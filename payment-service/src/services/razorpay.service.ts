import Razorpay from 'razorpay';
import crypto from 'crypto';
import { config } from '../config/env.config';
import { razorpayConfig } from '../config/razorpay.config';
import {
    createOrder,
    updateOrderByOrderId,
    getOrderByOrderId,
    updateOrderStatus,
    getOrderByRazorpayOrderId
} from '../repositories/order.repository';
import {
    ICreateRazorpayOrderParams,
    ICreateRazorpayOrderResponse,
    IRazorpayOrderResponse,
    IRazorpayPaymentResponse,
    IVerifyRazorpayPaymentParams
} from '../types/razorpay.types';

interface WebhookPaymentData {
    event: string;
    payload: {
        payment: {
            entity: {
                id: string;
                amount: number;
                currency: string;
                status: string;
                order_id: string;
                [key: string]: any;
            }
        }
    };
    [key: string]: any;
}

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!
});

const getRazorpayInstance = (): Razorpay => {
    if (!razorpayConfig.keyId || !razorpayConfig.keySecret) {
        throw new Error('Razorpay credentials are not configured');
    }

    return new Razorpay({
        key_id: razorpayConfig.keyId,
        key_secret: razorpayConfig.keySecret,
    });
};

export const createRazorpayOrderService = async (
    data: ICreateRazorpayOrderParams
): Promise<ICreateRazorpayOrderResponse> => {
    try {
        const orderId = `RAZOR_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const currency = data.currency || 'INR';

        const dbOrder = await createOrder({
            orderId,
            userId: data.userId,
            userEmail: data.userEmail,
            mobile: data.mobile,
            clientType: data.clientType,
            amount: data.amount,
            currency: currency,
            environment: razorpayConfig.environment,
            status: 'CREATED',
            paymentGateway: 'razorpay',
        });

        const razorpay = getRazorpayInstance();

        const razorpayOrderResponse = await razorpay.orders.create({
            amount: Math.round(data.amount * 100),
            currency: currency,
            receipt: orderId,
            notes: {
                userId: data.userId,
                userEmail: data.userEmail,
                mobile: data.mobile,
                clientType: data.clientType,
                orderId: orderId,
            },
            payment_capture: true,
        });

        const razorpayOrder = razorpayOrderResponse as unknown as IRazorpayOrderResponse;

        const updatedOrder = await updateOrderByOrderId(orderId, {
            razorpayOrderId: razorpayOrder.id,
            status: 'PENDING',
        });

        if (!updatedOrder) {
            throw new Error('Failed to update order with Razorpay details');
        }

        return {
            order: updatedOrder,
            razorpayOrderId: razorpayOrder.id,
            razorpayKeyId: razorpayConfig.keyId,
            amount: data.amount,
            currency: currency,
        };
    } catch (error: any) {
        throw new Error(error.message || 'Failed to create Razorpay order');
    }
};

export const verifyRazorpayPaymentService = async (
    data: IVerifyRazorpayPaymentParams
): Promise<any> => {
    try {
        const generatedSignature = crypto
            .createHmac('sha256', razorpayConfig.keySecret)
            .update(`${data.razorpayOrderId}|${data.razorpayPaymentId}`)
            .digest('hex');

        if (generatedSignature !== data.razorpaySignature) {
            throw new Error('Invalid payment signature');
        }

        const order = await getOrderByOrderId(data.orderId);

        if (!order) {
            throw new Error('Order not found');
        }

        if (order.paymentGateway !== 'razorpay') {
            throw new Error('This order is not a Razorpay order');
        }

        const razorpay = getRazorpayInstance();
        const paymentResponse = await razorpay.payments.fetch(data.razorpayPaymentId);
        const payment = paymentResponse as unknown as IRazorpayPaymentResponse;

        if (payment.status !== 'captured') {
            throw new Error(`Payment status is ${payment.status}, expected captured`);
        }

        const updatedOrder = await updateOrderStatus(
            data.orderId,
            'SUCCESS',
            { razorpayPaymentId: data.razorpayPaymentId }
        );

        return updatedOrder;
    } catch (error: any) {
        throw new Error(error.message || 'Failed to verify Razorpay payment');
    }
};

export const getRazorpayOrderService = async (orderId: string): Promise<any> => {
    try {
        const order = await getOrderByOrderId(orderId);

        if (!order) {
            throw new Error('Order not found');
        }

        if (order.paymentGateway !== 'razorpay') {
            throw new Error('This is not a Razorpay order');
        }

        return order;
    } catch (error: any) {
        throw new Error(error.message || 'Failed to fetch Razorpay order');
    }
};

export const getRazorpayPaymentStatusService = async (paymentId: string): Promise<IRazorpayPaymentResponse> => {
    try {
        const razorpay = getRazorpayInstance();
        const paymentResponse = await razorpay.payments.fetch(paymentId);
        const payment = paymentResponse as unknown as IRazorpayPaymentResponse;
        return payment;
    } catch (error: any) {
        throw new Error(error.message || 'Failed to fetch payment status from Razorpay');
    }
};

export const getRazorpayOrderDetailsService = async (razorpayOrderId: string): Promise<IRazorpayOrderResponse> => {
    try {
        const razorpay = getRazorpayInstance();
        const orderResponse = await razorpay.orders.fetch(razorpayOrderId);
        const order = orderResponse as unknown as IRazorpayOrderResponse;
        return order;
    } catch (error: any) {
        throw new Error(error.message || 'Failed to fetch order details from Razorpay');
    }
};

export const syncRazorpayOrderStatusService = async (orderId: string): Promise<any> => {
    try {
        const order = await getOrderByOrderId(orderId);

        if (!order) {
            throw new Error('Order not found');
        }

        if (order.paymentGateway !== 'razorpay') {
            throw new Error('This is not a Razorpay order');
        }

        if (!order.razorpayOrderId) {
            throw new Error('No Razorpay order ID found');
        }

        const razorpay = getRazorpayInstance();
        const razorpayOrderResponse = await razorpay.orders.fetch(order.razorpayOrderId);
        const razorpayOrder = razorpayOrderResponse as unknown as IRazorpayOrderResponse;

        let status: 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' = order.status;

        if (razorpayOrder.status === 'paid') {
            status = 'SUCCESS';
        } else if (razorpayOrder.status === 'failed') {
            status = 'FAILED';
        } else if (razorpayOrder.status === 'attempted') {
            status = 'PENDING';
        }

        if (status !== order.status) {
            const updatedOrder = await updateOrderStatus(orderId, status);
            return updatedOrder;
        }

        return order;
    } catch (error: any) {
        throw new Error(error.message || 'Failed to sync order status from Razorpay');
    }
};

export const refundRazorpayPaymentService = async (
    paymentId: string,
    amount?: number,
    notes?: any
): Promise<any> => {
    try {
        const razorpay = getRazorpayInstance();

        const refundData: any = {
            payment_id: paymentId,
        };

        if (amount) {
            refundData.amount = Math.round(amount * 100);
        }

        if (notes) {
            refundData.notes = notes;
        }

        const refund = await razorpay.payments.refund(paymentId, refundData);
        return refund;
    } catch (error: any) {
        throw new Error(error.message || 'Failed to process refund');
    }
};

export const razorpayWebhookService = async (
    webhookBody: string,
    signature: string
) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) {
            throw new Error('RAZORPAY_WEBHOOK_SECRET not configured');
        }

        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(webhookBody)
            .digest('hex');

        console.log('Expected Signature:', expectedSignature);
        console.log('Received Signature:', signature);

        if (expectedSignature !== signature) {
            throw new Error('Invalid webhook signature');
        }

        const webhookData = JSON.parse(webhookBody);
        console.log('Webhook Event:', webhookData.event);

        switch (webhookData.event) {
            case 'payment.captured':
                await handlePaymentCaptured(webhookData);
                break;
            case 'payment.failed':
                await handlePaymentFailed(webhookData);
                break;
            default:
                console.log(`Unhandled event: ${webhookData.event}`);
        }

        return { success: true };

    } catch (error: any) {
        console.error('Webhook service error:', error);
        throw error;
    }
};

// Handle payment captured event
const handlePaymentCaptured = async (webhookData: any) => {
    const payment = webhookData.payload?.payment?.entity;

    if (!payment) {
        console.error('No payment entity found');
        return;
    }

    console.log(`Payment captured: ${payment.id}`);
    console.log(`Amount: ${payment.amount / 100} ${payment.currency}`);

    // Try to get orderId from notes or payment
    let orderId = payment.order_id;

    if (!orderId && payment.notes?.orderId) {
        orderId = payment.notes.orderId;
    }

    // Update order if we have orderId
    if (orderId) {
        try {
            await updateOrderStatus(orderId, 'SUCCESS', {
                razorpayPaymentId: payment.id
            });
            console.log(`Order ${orderId} updated successfully`);
        } catch (error) {
            console.error(`Failed to update order:`, error);
        }
    } else {
        console.warn('No order_id found in webhook');
    }

    return payment;
};

// Handle payment failed event
const handlePaymentFailed = async (webhookData: WebhookPaymentData) => {
    const payment = webhookData.payload.payment.entity;

    console.log(`❌ Payment failed: ${payment.id}`);
    console.log(`   Error: ${payment.error_description || 'Unknown error'}`);

    // Update order status to failed in your database
    // await updateOrderStatus(payment.order_id, 'FAILED');
};

// Optional: Auto-capture authorized payments
const capturePayment = async (paymentId: string) => {
    try {
        const payment = await razorpay.payments.fetch(paymentId);

        if (payment.status === 'authorized') {
            const captured = await razorpay.payments.capture(paymentId, payment.amount, payment.currency);
            console.log(`Payment auto-captured: ${captured.id}`);
            return captured;
        }

        return payment;
    } catch (error) {
        console.error(`Failed to capture payment ${paymentId}:`, error);
        throw error;
    }
};

