import { createOrder, updateOrderByOrderId } from '../repositories/order.repository';
import { createCashfreeOrder } from './cashfree.service';

export const createOrderService = async (data: {
    amount: number;
    userId: string;
    customerPhone: string;
}) => {
    const orderId = `ORDER_${Date.now()}`;

    await createOrder({
        orderId,
        amount: data.amount,
        currency: 'INR',
        userId: data.userId,
        customerPhone: data.customerPhone,
        status: 'CREATED',
    });

    const cfResponse = await createCashfreeOrder({
        amount: data.amount,
        customerId: data.userId,
        customerPhone: data.customerPhone,
    });

    const updatedOrder = await updateOrderByOrderId(orderId, {
        cfOrderId: cfResponse.order_id,
        paymentSessionId: cfResponse.payment_session_id,
        status: 'PENDING',
    });

    return updatedOrder;
};