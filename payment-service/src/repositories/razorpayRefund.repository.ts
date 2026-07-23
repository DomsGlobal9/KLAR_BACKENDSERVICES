import { OrderModel, IRefund, RefundStatus, OrderStatus } from '../models/order.model';

export const createRefund = async (
    orderId: string,
    refundData: Partial<IRefund>
) => {
    return OrderModel.findOneAndUpdate(
        { orderId },
        {
            $push: { refunds: refundData },
            $inc: { totalRefundedAmount: refundData.amount || 0 },
        },
        { new: true }
    );
};

export const updateRefund = async (
    orderId: string,
    refundId: string,
    updateData: Partial<IRefund>
) => {
    return OrderModel.findOneAndUpdate(
        {
            orderId,
            'refunds.refundId': refundId
        },
        {
            $set: {
                'refunds.$.status': updateData.status,
                'refunds.$.processedAt': updateData.processedAt,
                'refunds.$.razorpayRefundId': updateData.razorpayRefundId,
                'refunds.$.notes': updateData.notes,
            },
        },
        { new: true }
    );
};

export const getRefundByRefundId = async (refundId: string) => {
    const result = await OrderModel.findOne(
        { 'refunds.refundId': refundId },
        { 'refunds.$': 1, orderId: 1, userId: 1, userEmail: 1, platform: 1 }
    );
    return result;
};

export const getRefundsByPaymentId = async (paymentId: string) => {
    const result = await OrderModel.findOne(
        { razorpayPaymentId: paymentId },
        { refunds: 1, orderId: 1, userId: 1, userEmail: 1, platform: 1 }
    );
    return result;
};

export const getRefundsByOrderId = async (orderId: string) => {
    const result = await OrderModel.findOne(
        { orderId },
        { refunds: 1, orderId: 1, userId: 1, userEmail: 1, platform: 1 }
    );
    return result;
};

export const updateRefundStatus = async (
    refundId: string,
    status: RefundStatus,
    additionalData?: Partial<IRefund>
) => {
    return OrderModel.findOneAndUpdate(
        { 'refunds.refundId': refundId },
        {
            $set: {
                'refunds.$.status': status,
                ...additionalData,
            },
        },
        { new: true }
    );
};

export const getRefundByRazorpayRefundId = async (razorpayRefundId: string) => {
    const result = await OrderModel.findOne(
        { 'refunds.razorpayRefundId': razorpayRefundId },
        { 'refunds.$': 1, orderId: 1, userId: 1, userEmail: 1, platform: 1 }
    );
    return result;
};

export const updateOrderStatusBasedOnRefunds = async (orderId: string) => {
    const order = await OrderModel.findOne({ orderId });
    if (!order) {
        return null;
    }

    const totalRefunded = order.totalRefundedAmount || 0;
    const orderAmount = order.amount;

    let newStatus: OrderStatus = order.status;

    if (totalRefunded >= orderAmount) {
        newStatus = 'REFUNDED';
    } else if (totalRefunded > 0 && totalRefunded < orderAmount) {
        newStatus = 'PARTIALLY_REFUNDED';
    }

    if (newStatus !== order.status) {
        return OrderModel.findOneAndUpdate(
            { orderId },
            { status: newStatus },
            { new: true }
        );
    }

    return order;
};

export const getAllRefundsByUserId = async (userId: string, limit = 10, skip = 0) => {
    const result = await OrderModel.aggregate([
        { $match: { userId } },
        { $unwind: '$refunds' },
        { $sort: { 'refunds.createdAt': -1 } },
        { $skip: skip },
        { $limit: limit },
        {
            $project: {
                orderId: 1,
                userId: 1,
                userEmail: 1,
                platform: 1,
                refund: '$refunds',
                orderAmount: '$amount',
                orderStatus: '$status'
            }
        }
    ]);
    return result;
};