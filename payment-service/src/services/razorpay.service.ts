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
    payload: any,
    signature: string
): Promise<boolean> => {
    // Verify webhook signature
    const expectedSignature = crypto
        .createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET!)
        .update(JSON.stringify(payload))
        .digest('hex');

    if (expectedSignature !== signature) {
        console.error('Webhook signature mismatch');
        throw new Error('Invalid webhook signature');
    }

    const event = payload.event;
    console.log(`Received webhook event: ${event}`);

    if (event === 'payment.captured') {
        const paymentEntity = payload.payload.payment.entity;
        const razorpayOrderId = paymentEntity.order_id;
        const razorpayPaymentId = paymentEntity.id;
        const paymentMethod = paymentEntity.method;
        const paymentStatus = paymentEntity.status;

        console.log(`Payment captured - Order: ${razorpayOrderId}, Method: ${paymentMethod}, Status: ${paymentStatus}`);

        const order = await getOrderByRazorpayOrderId(razorpayOrderId);

        if (!order) {
            console.error(`Order not found for razorpayOrderId: ${razorpayOrderId}`);
            throw new Error('Order not found');
        }

        if (order.status === 'SUCCESS') {
            console.log(`Order ${order.orderId} already marked as SUCCESS. Skipping update.`);
            return true;
        }

        const updatedOrder = await updateOrderStatus(
            order.orderId,
            'SUCCESS',
            {
                razorpayPaymentId: razorpayPaymentId
            }
        );

        console.log(`Order ${order.orderId} updated to SUCCESS with payment ${razorpayPaymentId}`);
    }
    
    else if (event === 'payment.failed') {
        const paymentEntity = payload.payload.payment.entity;
        const razorpayOrderId = paymentEntity.order_id;
        const errorReason = paymentEntity.error_description || 'Payment failed';

        console.log(`Payment failed - Order: ${razorpayOrderId}, Reason: ${errorReason}`);

        const order = await getOrderByRazorpayOrderId(razorpayOrderId);

        if (order && order.status !== 'SUCCESS') {
            await updateOrderStatus(order.orderId, 'FAILED');
            console.log(`Order ${order.orderId} marked as FAILED`);
        }
    }

    return true;
};