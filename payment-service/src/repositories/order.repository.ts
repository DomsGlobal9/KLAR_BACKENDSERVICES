import { OrderModel, IOrder, OrderStatus } from '../models/order.model';

export const createOrder = async (data: Partial<IOrder>) => {
    return OrderModel.create(data);
};

export const updateOrderByOrderId = async (
    orderId: string,
    update: Partial<IOrder>
) => {
    return OrderModel.findOneAndUpdate(
        { orderId },
        update,
        { new: true }
    );
};

export const getOrderByOrderId = async (orderId: string) => {
    return OrderModel.findOne({ orderId });
};

export const getOrderByCfOrderId = async (cfOrderId: string) => {
    return OrderModel.findOne({ cfOrderId });
};

export const updateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    additionalData?: Partial<IOrder>
) => {
    return OrderModel.findOneAndUpdate(
        { orderId },
        { status, ...additionalData },
        { new: true }
    );
};

export const getAllOrdersByUserId = async (userId: string, limit = 10, skip = 0) => {
    return OrderModel.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);
};

export const getOrderByRazorpayOrderId = async (
    razorpayOrderId: string
) => {
    return OrderModel.findOne({ razorpayOrderId });
};

export const getOrderByRazorpayPaymentId = async (
    razorpayPaymentId: string
) => {
    return OrderModel.findOne({ razorpayPaymentId });
};

export const updateOrderByRazorpayOrderId = async (
    razorpayOrderId: string,
    update: Partial<IOrder>
) => {
    return OrderModel.findOneAndUpdate(
        { razorpayOrderId },
        update,
        { new: true }
    );
};