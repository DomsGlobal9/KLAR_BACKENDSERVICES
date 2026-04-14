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

export const updateOrderStatus = async (
    orderId: string,
    status: OrderStatus
) => {
    return OrderModel.findOneAndUpdate(
        { orderId },
        { status },
        { new: true }
    );
};