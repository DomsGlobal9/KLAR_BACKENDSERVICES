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
    updateOrderByRazorpayOrderId
} from '../repositories/order.repository';
import {
    ICreateRazorpayOrderParams,
    ICreateRazorpayOrderResponse,
    IRazorpayOrderResponse,
    IRazorpayPaymentResponse,
    IVerifyRazorpayPaymentParams,
    IWebhookPaymentData
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
};

export const verifyRazorpayPaymentService = async (
    data: IVerifyRazorpayPaymentParams
): Promise<any> => {
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

    if (order.status === 'SUCCESS') {
        return order;
    }

    const razorpay = getRazorpayInstance();
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

export const getRazorpayPaymentStatusService = async (paymentId: string): Promise<IRazorpayPaymentResponse> => {
    const razorpay = getRazorpayInstance();
    const paymentResponse = await razorpay.payments.fetch(paymentId);
    const payment = paymentResponse as unknown as IRazorpayPaymentResponse;
    return payment;
};

export const getRazorpayOrderDetailsService = async (razorpayOrderId: string): Promise<IRazorpayOrderResponse> => {
    const razorpay = getRazorpayInstance();
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
};

export const refundRazorpayPaymentService = async (
    paymentId: string,
    amount?: number,
    notes?: any
): Promise<any> => {
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
};

const creditUserWallet = async (userId: string, amount: number, paymentId: string, orderId: string) => {
    console.log(`Crediting wallet for user ${userId} with amount ${amount}`);
    console.log(`Payment ID: ${paymentId}, Order ID: ${orderId}`);
    return true;
};

export const razorpayWebhookService = async (
    webhookBody: string,
    signature: string
) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
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
    console.log('Webhook Event:', webhookData.event);

    switch (webhookData.event) {
        case 'payment.captured':
            await handlePaymentCaptured(webhookData);
            break;
        case 'payment.authorized':
            await handlePaymentAuthorized(webhookData);
            break;
        case 'payment.failed':
            await handlePaymentFailed(webhookData);
            break;
        case 'order.paid':
            console.log('Order paid event received');
            break;
        default:
            console.log(`Unhandled event: ${webhookData.event}`);
    }

    return { success: true };
};

const handlePaymentCaptured = async (webhookData: IWebhookPaymentData) => {
    const payment = webhookData.payload?.payment?.entity;

    if (!payment) {
        console.error('No payment entity found');
        return;
    }

    console.log(`Payment captured: ${payment.id}`);
    console.log(`Amount: ${payment.amount / 100} ${payment.currency}`);

    const existingOrder = await getOrderByRazorpayPaymentId(payment.id);
    if (existingOrder && existingOrder.status === 'SUCCESS') {
        console.log(`Order ${existingOrder.orderId} already processed, skipping duplicate webhook`);
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
                razorpayPaymentId: payment.id
            });

            await creditUserWallet(order.userId, order.amount, payment.id, orderId);
            console.log(`Order ${orderId} updated and wallet credited successfully`);
        } else if (order && order.status === 'SUCCESS') {
            console.log(`Order ${orderId} already successful, skipping duplicate processing`);
        }
    } else {
        console.warn('No order_id found in webhook');
    }

    return payment;
};

const handlePaymentAuthorized = async (webhookData: IWebhookPaymentData) => {
    const payment = webhookData.payload?.payment?.entity;

    if (!payment) {
        console.error('No payment entity found');
        return;
    }

    console.log(`Payment authorized: ${payment.id}`);
    console.log(`Amount: ${payment.amount / 100} ${payment.currency}`);
    console.log(`Payment will be auto-captured or will expire in 3 days`);

    let orderId = payment.order_id;

    if (!orderId && payment.notes?.orderId) {
        orderId = payment.notes.orderId;
    }

    if (orderId) {
        const order = await getOrderByRazorpayOrderId(orderId);

        if (order && order.status === 'PENDING') {
            await updateOrderStatus(orderId, 'PENDING', {
                razorpayPaymentId: payment.id
            });
            console.log(`Order ${orderId} updated to PENDING with authorized payment`);
        }
    }
};

const handlePaymentFailed = async (webhookData: IWebhookPaymentData) => {
    const payment = webhookData.payload?.payment?.entity;

    console.log(`Payment failed: ${payment.id}`);
    console.log(`Error: ${payment.error_description || 'Unknown error'}`);

    let orderId = payment.order_id;

    if (!orderId && payment.notes?.orderId) {
        orderId = payment.notes.orderId;
    }

    if (orderId) {
        const order = await getOrderByRazorpayOrderId(orderId);

        if (order && order.status !== 'FAILED') {
            await updateOrderStatus(orderId, 'FAILED', {
                razorpayPaymentId: payment.id
            });
            console.log(`Order ${orderId} updated to FAILED`);
        }
    }
};

const autoCaptureAuthorizedPayments = async () => {
    console.log('Checking for authorized payments to auto-capture');
    // This function would be called by a cron job
    // Implementation depends on your order fetching logic
};