import Razorpay from 'razorpay';
import crypto from 'crypto';
import { razorpayConfig } from '../config/razorpay.config';
import {
    createOrder,
    updateOrderByOrderId,
    getOrderByOrderId,
    updateOrderStatus,
    getOrderByRazorpayOrderId,
    getOrderByRazorpayPaymentId,
    updateOrderByRazorpayOrderId,
    updateOrderByRazorpayPaymentId
} from '../repositories/order.repository';
import {
    ICreateRazorpayOrderParams,
    ICreateRazorpayOrderResponse,
    IRazorpayOrderResponse,
    IRazorpayPaymentResponse,
    IVerifyRazorpayPaymentParams,
    IWebhookPaymentData
} from '../types/razorpay.types';

export const getRazorpayInstance = (platform: 'B2B' | 'B2C'): Razorpay => {
    const config = platform === 'B2B' ? razorpayConfig.b2b : razorpayConfig.b2c;

    if (!config.keyId || !config.keySecret) {
        throw new Error(`Razorpay ${platform} credentials are not configured`);
    }

    return new Razorpay({
        key_id: config.keyId,
        key_secret: config.keySecret,
    });
};

const getRazorpayKeyId = (platform: 'B2B' | 'B2C'): string => {
    const config = platform === 'B2B' ? razorpayConfig.b2b : razorpayConfig.b2c;
    return config.keyId;
};

export const createRazorpayOrderService = async (
    data: ICreateRazorpayOrderParams
): Promise<ICreateRazorpayOrderResponse> => {

    const orderId = `RAZOR_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const currency = data.currency || 'INR';

    const existingOrder = await getOrderByOrderId(orderId);
    if (existingOrder) {
        throw new Error('Duplicate order ID generated');
    }

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
        platform: data.platform,
        bookingId: data.bookingId,
    });

    const razorpay = getRazorpayInstance(data.platform);

    const razorpayOrderResponse = await razorpay.orders.create({
        amount: Math.round(data.amount * 100),
        currency: currency,
        receipt: orderId,
        notes: {
            userId: data.userId || 'guest',
            userEmail: data.userEmail || 'guest',
            mobile: data.mobile || 'guest',
            clientType: data.clientType,
            orderId: orderId,
            platform: data.platform,
            bookingId: data.bookingId || 'N/A',
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
        razorpayKeyId: getRazorpayKeyId(data.platform),
        amount: data.amount,
        currency: currency,
        platform: data.platform,
        bookingId: data.bookingId,
    };
};

export const verifyRazorpayPaymentService = async (
    data: IVerifyRazorpayPaymentParams
): Promise<any> => {
    const order = await getOrderByOrderId(data.orderId);

    if (!order) {
        throw new Error('Order not found');
    }

    if (order.paymentGateway !== 'razorpay') {
        throw new Error('This order is not a Razorpay order');
    }

    const platform = data.platform || order.platform || 'B2B';
    const config = platform === 'B2B' ? razorpayConfig.b2b : razorpayConfig.b2c;

    const generatedSignature = crypto
        .createHmac('sha256', config.keySecret)
        .update(`${data.razorpayOrderId}|${data.razorpayPaymentId}`)
        .digest('hex');

    if (generatedSignature !== data.razorpaySignature) {
        throw new Error('Invalid payment signature');
    }

    if (order.status === 'SUCCESS') {
        return order;
    }

    const razorpay = getRazorpayInstance(platform);
    const paymentResponse = await razorpay.payments.fetch(data.razorpayPaymentId);
    const payment = paymentResponse as unknown as IRazorpayPaymentResponse;

    if (payment.status !== 'captured' && payment.status !== 'authorized') {
        throw new Error(`Payment status is ${payment.status}, expected captured or authorized`);
    }

    let updatedStatus: 'SUCCESS' | 'PENDING' = payment.status === 'captured' ? 'SUCCESS' : 'PENDING';

    const updatedOrder = await updateOrderStatus(
        data.orderId,
        updatedStatus,
        { razorpayPaymentId: data.razorpayPaymentId }
    );

    return updatedOrder;
};

export const getRazorpayOrderService = async (orderId: string): Promise<any> => {
    const order = await getOrderByOrderId(orderId);

    if (!order) {
        throw new Error('Order not found');
    }

    if (order.paymentGateway !== 'razorpay') {
        throw new Error('This is not a Razorpay order');
    }

    return order;
};

export const getRazorpayPaymentStatusService = async (paymentId: string, platform?: 'B2B' | 'B2C'): Promise<IRazorpayPaymentResponse> => {
    if (!platform) {
        const order = await getOrderByRazorpayPaymentId(paymentId);
        if (order) {
            platform = order.platform;
        } else {
            platform = 'B2B';
        }
    }

    const razorpay = getRazorpayInstance(platform);
    const paymentResponse = await razorpay.payments.fetch(paymentId);
    const payment = paymentResponse as unknown as IRazorpayPaymentResponse;
    return payment;
};

/**
 * Server-side payment verification for the booking services.
 *
 * A committed booking must never trust a client-supplied razorpayPaymentId. This
 * fetches the payment straight from Razorpay and confirms it is genuinely
 * captured, belongs to the expected order, and covers the expected amount.
 * Amounts are in rupees; Razorpay reports paise, so we divide by 100.
 */
export const verifyPaymentForBookingService = async (params: {
    paymentId: string;
    orderId?: string;
    expectedAmount?: number;
    platform?: 'B2B' | 'B2C';
}): Promise<{
    verified: boolean;
    reason?: string;
    status: string;
    capturedAmount: number;
    currency: string;
    razorpayOrderId: string;
}> => {
    const { paymentId, orderId, expectedAmount } = params;

    let platform = params.platform;
    if (!platform) {
        const order = await getOrderByRazorpayPaymentId(paymentId);
        platform = order?.platform || 'B2C';
    }

    const razorpay = getRazorpayInstance(platform);
    const paymentResponse = await razorpay.payments.fetch(paymentId);
    const payment = paymentResponse as unknown as IRazorpayPaymentResponse;

    const capturedAmount = (Number(payment.amount) || 0) / 100; // paise -> rupees
    const isCaptured = payment.status === 'captured' || payment.captured === true;

    let verified = true;
    let reason: string | undefined;

    if (!isCaptured) {
        verified = false;
        reason = `Payment not captured (status: ${payment.status}).`;
    } else if (orderId && payment.order_id && payment.order_id !== orderId) {
        verified = false;
        reason = 'Payment does not belong to the expected order.';
    } else if (
        expectedAmount !== undefined &&
        capturedAmount + 0.01 < Number(expectedAmount)
    ) {
        verified = false;
        reason = `Captured amount (${capturedAmount}) is below the expected amount (${expectedAmount}).`;
    }

    return {
        verified,
        reason,
        status: payment.status,
        capturedAmount,
        currency: payment.currency,
        razorpayOrderId: payment.order_id,
    };
};

export const getRazorpayOrderDetailsService = async (razorpayOrderId: string, platform?: 'B2B' | 'B2C'): Promise<IRazorpayOrderResponse> => {
    if (!platform) {
        const order = await getOrderByRazorpayOrderId(razorpayOrderId);
        if (order) {
            platform = order.platform;
        } else {
            platform = 'B2B';
        }
    }

    const razorpay = getRazorpayInstance(platform);
    const orderResponse = await razorpay.orders.fetch(razorpayOrderId);
    const order = orderResponse as unknown as IRazorpayOrderResponse;
    return order;
};

export const syncRazorpayOrderStatusService = async (orderId: string): Promise<any> => {
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

    const platform = order.platform || 'B2B';
    const razorpay = getRazorpayInstance(platform);
    const razorpayOrderResponse = await razorpay.orders.fetch(order.razorpayOrderId);
    const razorpayOrder = razorpayOrderResponse as unknown as IRazorpayOrderResponse;

    let status: 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' = order.status;

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
};

export const refundRazorpayPaymentService = async (
    paymentId: string,
    amount?: number,
    notes?: any,
    platform?: 'B2B' | 'B2C'
): Promise<any> => {
    if (!platform) {
        const order = await getOrderByRazorpayPaymentId(paymentId);
        if (order) {
            platform = order.platform;
        } else {
            platform = 'B2B';
        }
    }

    const razorpay = getRazorpayInstance(platform);

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
};

const creditUserWallet = async (userId: string, amount: number, paymentId: string, orderId: string, platform: 'B2B' | 'B2C') => {


    return true;
};

export const razorpayWebhookService = async (
    webhookBody: string,
    signature: string
) => {
    const secret = razorpayConfig.webhookSecret;
    if (!secret) {
        throw new Error('RAZORPAY_WEBHOOK_SECRET not configured');
    }

    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(webhookBody)
        .digest('hex');

    if (expectedSignature !== signature) {
        throw new Error('Invalid webhook signature');
    }

    const webhookData: IWebhookPaymentData = JSON.parse(webhookBody);


    const payment = webhookData.payload?.payment?.entity;
    let platform: 'B2B' | 'B2C' = 'B2B';

    if (payment && payment.notes && payment.notes.platform) {
        platform = payment.notes.platform as 'B2B' | 'B2C';
    } else if (payment && payment.order_id) {
        const order = await getOrderByRazorpayOrderId(payment.order_id);
        if (order && order.platform) {
            platform = order.platform;
        }
    }

    switch (webhookData.event) {
        case 'payment.captured':
            await handlePaymentCaptured(webhookData, platform);
            break;
        case 'payment.authorized':
            await handlePaymentAuthorized(webhookData, platform);
            break;
        case 'payment.failed':
            await handlePaymentFailed(webhookData, platform);
            break;
        case 'order.paid':

            break;
        default:

    }

    return { success: true };
};

const handlePaymentCaptured = async (webhookData: IWebhookPaymentData, platform: 'B2B' | 'B2C') => {
    const payment = webhookData.payload?.payment?.entity;

    if (!payment) {

        return;
    }





    const existingOrder = await getOrderByRazorpayPaymentId(payment.id);
    if (existingOrder && existingOrder.status === 'SUCCESS') {

        return;
    }

    let orderId = payment.order_id;

    if (!orderId && payment.notes?.orderId) {
        orderId = payment.notes.orderId;
    }

    if (orderId) {
        const order = await getOrderByRazorpayOrderId(orderId);

        if (order && order.status !== 'SUCCESS') {
            await updateOrderStatus(orderId, 'SUCCESS', {
                razorpayPaymentId: payment.id,
                platform: platform
            });

            await creditUserWallet(order.userId, order.amount, payment.id, orderId, platform);

        } else if (order && order.status === 'SUCCESS') {

        } else {

        }
    } else {

    }

    return payment;
};

const handlePaymentAuthorized = async (webhookData: IWebhookPaymentData, platform: 'B2B' | 'B2C') => {
    const payment = webhookData.payload?.payment?.entity;

    if (!payment) {

        return;
    }






    let orderId = payment.order_id;

    if (!orderId && payment.notes?.orderId) {
        orderId = payment.notes.orderId;
    }

    if (orderId) {
        const order = await getOrderByRazorpayOrderId(orderId);

        if (order && order.status === 'PENDING') {
            await updateOrderStatus(orderId, 'PENDING', {
                razorpayPaymentId: payment.id,
                platform: platform
            });

        }
    }
};

const handlePaymentFailed = async (webhookData: IWebhookPaymentData, platform: 'B2B' | 'B2C') => {
    const payment = webhookData.payload?.payment?.entity;

    if (!payment) {

        return;
    }





    let orderId = payment.order_id;

    if (!orderId && payment.notes?.orderId) {
        orderId = payment.notes.orderId;
    }

    if (orderId) {
        const order = await getOrderByRazorpayOrderId(orderId);

        if (order && order.status !== 'FAILED') {
            await updateOrderStatus(orderId, 'FAILED', {
                razorpayPaymentId: payment.id,
                platform: platform
            });

        }
    }
};
