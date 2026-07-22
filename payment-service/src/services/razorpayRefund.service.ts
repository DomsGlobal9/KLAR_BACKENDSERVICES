import {
    createRefund,
    updateRefund,
    getRefundByRefundId,
    getRefundsByPaymentId,
    getRefundsByOrderId,
    updateRefundStatus,
    getRefundByRazorpayRefundId,
    updateOrderStatusBasedOnRefunds,
    getAllRefundsByUserId
} from '../repositories/razorpayRefund.repository';
import { getOrderByRazorpayPaymentId, getOrderByOrderId, getOrderByBookingId } from '../repositories/order.repository';
import { IRefund, RefundStatus } from '../models/order.model';
import { ICreateRefundParams, IRefundResponse, IRazorpayRefundResponse } from '../types/razorpayRefund.types';
import { getRazorpayInstance } from './razorpay.service';

const generateRefundId = (): string => {
    return `REF_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
};

export const createRefundService = async (
    params: ICreateRefundParams
): Promise<IRefundResponse> => {
    const { paymentId, orderId, amount, reason, notes } = params;

    let order = null;
    if (orderId) {
        order = await getOrderByOrderId(orderId);
    } else {
        order = await getOrderByRazorpayPaymentId(paymentId);
    }

    if (!order) {
        throw new Error('Order not found');
    }

    if (order.paymentGateway !== 'razorpay') {
        throw new Error('This order is not a Razorpay order');
    }

    if (order.platform !== 'B2C') {
        throw new Error('Refunds are only allowed for B2C orders');
    }

    const platform = order.platform || 'B2C';
    const razorpay = getRazorpayInstance(platform);

    const paymentResponse = await razorpay.payments.fetch(paymentId);
    const payment = paymentResponse as any;

    if (payment.status !== 'captured') {
        throw new Error(`Payment status is ${payment.status}, only captured payments can be refunded`);
    }

    const maxRefundableAmount = (Number(payment.amount) / 100) - (order.totalRefundedAmount || 0);
    const refundAmount = amount || maxRefundableAmount;

    if (refundAmount <= 0) {
        throw new Error('Refund amount must be greater than 0');
    }

    if (refundAmount > maxRefundableAmount) {
        throw new Error(`Refund amount (${refundAmount}) exceeds maximum refundable amount (${maxRefundableAmount})`);
    }

    const refundId = generateRefundId();

    const refundData: Partial<IRefund> = {
        refundId,
        razorpayRefundId: '',
        paymentId,
        amount: refundAmount,
        currency: payment.currency || 'INR',
        status: 'pending',
        reason,
        notes: {
            ...notes,
            orderId: order.orderId,
            userId: order.userId,
            userEmail: order.userEmail,
            platform: order.platform,
            requestedAt: new Date().toISOString()
        }
    };

    const updatedOrder = await createRefund(order.orderId, refundData);
    if (!updatedOrder) {
        throw new Error('Failed to create refund record');
    }

    try {
        const refundAmountInPaise = Math.round(refundAmount * 100);
        const razorpayRefund = await razorpay.payments.refund(paymentId, {
            amount: refundAmountInPaise,
            notes: {
                refundId,
                orderId: order.orderId,
                userId: order.userId,
                reason: reason || 'Customer requested refund',
                ...notes
            }
        });

        const refundResponse = razorpayRefund as IRazorpayRefundResponse;

        const updatedRefund = await updateRefund(
            order.orderId,
            refundId,
            {
                razorpayRefundId: refundResponse.id,
                status: 'processed',
                processedAt: new Date(),
                notes: {
                    ...refundData.notes,
                    razorpayRefundResponse: refundResponse
                }
            }
        );

        await updateOrderStatusBasedOnRefunds(order.orderId);

        if (!updatedRefund) {
            throw new Error('Failed to update refund record');
        }

        const refund = updatedRefund.refunds.find((r: IRefund) => r.refundId === refundId);
        if (!refund) {
            throw new Error('Refund not found after update');
        }

        return {
            refundId: refund.refundId,
            razorpayRefundId: refund.razorpayRefundId,
            paymentId: refund.paymentId,
            amount: refund.amount,
            currency: refund.currency,
            status: refund.status as RefundStatus,
            reason: refund.reason,
            notes: refund.notes,
            processedAt: refund.processedAt,
            createdAt: refund.createdAt,
            updatedAt: refund.updatedAt
        };

    } catch (error: any) {
        await updateRefund(
            order.orderId,
            refundId,
            {
                status: 'failed',
                notes: {
                    ...refundData.notes,
                    error: error.message || 'Refund failed'
                }
            }
        );

        throw new Error(error?.error?.description || error.message || 'Failed to process refund');
    }
};

export const createRefundByBookingIdService = async (
    bookingId: string,
    amount: number,
): Promise<IRefundResponse> => {
    if (!bookingId) throw new Error('bookingId is required');
    if (!amount) throw new Error('Amount is required for refund');

    const order = await getOrderByBookingId(bookingId);
    if (!order) throw new Error(`Order not found for bookingId: ${bookingId}`);
    if (order.platform !== 'B2C' || order.clientType !== 'B2C') throw new Error('Refunds are only allowed for B2C orders');
    if (order.paymentGateway !== 'razorpay') throw new Error('This order is not a Razorpay order.');
    if (order.status !== 'SUCCESS') throw new Error('This payment is not completed yet.');

    const paymentId = order.razorpayPaymentId;
    if (!paymentId) throw new Error('No payment found for this order');

    const payment = await getRazorpayInstance(order.platform || 'B2C').payments.fetch(paymentId) as any;
    if (payment.status !== 'captured') throw new Error(`Payment status is ${payment.status}, only captured payments can be refunded`);

    const maxRefundableAmount = (Number(payment.amount) / 100) - (order.totalRefundedAmount || 0);
    const refundAmount = amount || maxRefundableAmount;
    if (refundAmount <= 0) throw new Error('Refund amount must be greater than 0');
    if (refundAmount > maxRefundableAmount) throw new Error(`Refund amount (${refundAmount}) exceeds maximum refundable amount (${maxRefundableAmount})`);

    const refundId = generateRefundId();
    const refundData: Partial<IRefund> = {
        refundId,
        razorpayRefundId: '',
        paymentId,
        amount: refundAmount,
        currency: payment.currency || 'INR',
        status: 'pending',
        notes: { bookingId, orderId: order.orderId, userId: order.userId, userEmail: order.userEmail, platform: order.platform, requestedAt: new Date().toISOString() }
    };

    const updatedOrder = await createRefund(order.orderId, refundData);
    if (!updatedOrder) throw new Error('Failed to create refund record');

    try {
        const razorpayRefund = await getRazorpayInstance(order.platform || 'B2C').payments.refund(paymentId, {
            amount: Math.round(refundAmount * 100),
            notes: { refundId, bookingId, orderId: order.orderId, userId: order.userId }
        });

        const updatedRefund = await updateRefund(order.orderId, refundId, {
            razorpayRefundId: (razorpayRefund as IRazorpayRefundResponse).id,
            status: 'processed',
            processedAt: new Date(),
            notes: { ...refundData.notes, razorpayRefundResponse: razorpayRefund }
        });

        await updateOrderStatusBasedOnRefunds(order.orderId);
        if (!updatedRefund) throw new Error('Failed to update refund record');

        const refund = updatedRefund.refunds.find((r: IRefund) => r.refundId === refundId);
        if (!refund) throw new Error('Refund not found after update');

        const { refundId: rId, razorpayRefundId, paymentId: pId, amount: amt, currency, status, reason, notes, processedAt, createdAt, updatedAt } = refund;
        return { refundId: rId, razorpayRefundId, paymentId: pId, amount: amt, currency, status, reason, notes, processedAt, createdAt, updatedAt };
    } catch (error: any) {
        await updateRefund(order.orderId, refundId, {
            status: 'failed',
            notes: { ...refundData.notes, error: error.message || 'Refund failed' }
        });
        throw new Error(error?.error?.description || error.message || 'Failed to process refund');
    }
};

export const getRefundByRefundIdService = async (refundId: string): Promise<IRefundResponse> => {
    const result = await getRefundByRefundId(refundId);
    if (!result) {
        throw new Error('Refund not found');
    }

    const refund = result.refunds[0] as IRefund;
    return {
        refundId: refund.refundId,
        razorpayRefundId: refund.razorpayRefundId,
        paymentId: refund.paymentId,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status as RefundStatus,
        reason: refund.reason,
        notes: refund.notes,
        processedAt: refund.processedAt,
        createdAt: refund.createdAt,
        updatedAt: refund.updatedAt
    };
};

export const getRefundsByPaymentIdService = async (paymentId: string): Promise<IRefundResponse[]> => {
    const result = await getRefundsByPaymentId(paymentId);
    if (!result || !result.refunds) {
        return [];
    }

    return result.refunds.map((refund: IRefund) => ({
        refundId: refund.refundId,
        razorpayRefundId: refund.razorpayRefundId,
        paymentId: refund.paymentId,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status as RefundStatus,
        reason: refund.reason,
        notes: refund.notes,
        processedAt: refund.processedAt,
        createdAt: refund.createdAt,
        updatedAt: refund.updatedAt
    }));
};

export const getRefundsByOrderIdService = async (orderId: string): Promise<IRefundResponse[]> => {
    const result = await getRefundsByOrderId(orderId);
    if (!result || !result.refunds) {
        return [];
    }

    return result.refunds.map((refund: IRefund) => ({
        refundId: refund.refundId,
        razorpayRefundId: refund.razorpayRefundId,
        paymentId: refund.paymentId,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status as RefundStatus,
        reason: refund.reason,
        notes: refund.notes,
        processedAt: refund.processedAt,
        createdAt: refund.createdAt,
        updatedAt: refund.updatedAt
    }));
};

export const updateRefundStatusService = async (
    refundId: string,
    status: RefundStatus,
    additionalData?: Partial<IRefund>
): Promise<IRefundResponse> => {
    const result = await updateRefundStatus(refundId, status, additionalData);
    if (!result) {
        throw new Error('Refund not found');
    }

    const refund = result.refunds.find((r: IRefund) => r.refundId === refundId);
    if (!refund) {
        throw new Error('Refund not found after update');
    }

    await updateOrderStatusBasedOnRefunds(result.orderId);

    return {
        refundId: refund.refundId,
        razorpayRefundId: refund.razorpayRefundId,
        paymentId: refund.paymentId,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status as RefundStatus,
        reason: refund.reason,
        notes: refund.notes,
        processedAt: refund.processedAt,
        createdAt: refund.createdAt,
        updatedAt: refund.updatedAt
    };
};

export const getRefundByRazorpayRefundIdService = async (razorpayRefundId: string): Promise<IRefundResponse> => {
    const result = await getRefundByRazorpayRefundId(razorpayRefundId);
    if (!result) {
        throw new Error('Refund not found');
    }

    const refund = result.refunds[0] as IRefund;
    return {
        refundId: refund.refundId,
        razorpayRefundId: refund.razorpayRefundId,
        paymentId: refund.paymentId,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status as RefundStatus,
        reason: refund.reason,
        notes: refund.notes,
        processedAt: refund.processedAt,
        createdAt: refund.createdAt,
        updatedAt: refund.updatedAt
    };
};

export const getAllRefundsByUserIdService = async (
    userId: string,
    limit = 10,
    skip = 0
): Promise<any[]> => {
    return getAllRefundsByUserId(userId, limit, skip);
};

export const verifyRefundWebhookService = async (
    refundId: string,
    razorpayRefundId: string,
    status: string
): Promise<void> => {
    const result = await getRefundByRefundId(refundId);
    if (!result) {
        throw new Error('Refund not found');
    }

    const refund = result.refunds[0] as IRefund;
    if (refund.status === 'processed') {
        return;
    }

    let refundStatus: RefundStatus = 'pending';
    if (status === 'processed' || status === 'completed') {
        refundStatus = 'processed';
    } else if (status === 'failed') {
        refundStatus = 'failed';
    } else if (status === 'cancelled') {
        refundStatus = 'cancelled';
    }

    await updateRefundStatus(refundId, refundStatus, {
        razorpayRefundId,
        processedAt: refundStatus === 'processed' ? new Date() : undefined
    });

    await updateOrderStatusBasedOnRefunds(result.orderId);
};

export const fetchRefundFromRazorpayService = async (
    refundId: string,
    platform?: 'B2B' | 'B2C'
): Promise<IRazorpayRefundResponse> => {
    if (!platform) {
        const result = await getRefundByRefundId(refundId);
        if (result) {
            const order = await getOrderByOrderId(result.orderId);
            if (order) {
                platform = order.platform;
            }
        }
    }

    if (!platform) {
        platform = 'B2C';
    }

    const razorpay = getRazorpayInstance(platform);
    const refundResponse = await razorpay.refunds.fetch(refundId);
    return refundResponse as IRazorpayRefundResponse;
};

export const fetchAllRefundsFromRazorpayService = async (
    platform?: 'B2B' | 'B2C',
    from?: number,
    to?: number,
    count?: number,
    skip?: number
): Promise<any> => {
    if (!platform) {
        platform = 'B2C';
    }

    const razorpay = getRazorpayInstance(platform);
    const options: any = {};

    if (from) options.from = from;
    if (to) options.to = to;
    if (count) options.count = count;
    if (skip) options.skip = skip;

    const refunds = await razorpay.refunds.all(options);
    return refunds;
};

export const updateRefundNotesService = async (
    refundId: string,
    notes: Record<string, any>,
    platform?: 'B2B' | 'B2C'
): Promise<IRazorpayRefundResponse> => {
    if (!platform) {
        const result = await getRefundByRefundId(refundId);
        if (result) {
            const order = await getOrderByOrderId(result.orderId);
            if (order) {
                platform = order.platform;
            }
        }
    }

    if (!platform) {
        platform = 'B2C';
    }

    const razorpay = getRazorpayInstance(platform);
    const updatedRefund = await razorpay.refunds.edit(refundId, { notes });
    return updatedRefund as IRazorpayRefundResponse;
};