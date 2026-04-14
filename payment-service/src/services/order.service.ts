import {
    createOrder,
    updateOrderByOrderId,
    getOrderByOrderId,
    updateOrderStatus
} from '../repositories/order.repository';
import { createCashfreeOrder, getCashfreeOrder, getCashfreePaymentStatus } from './cashfree.service';

export const createOrderService = async (data: {
    amount: number;
    userId: string;
    customerPhone: string;
    customerEmail?: string;
    customerName?: string;
}) => {
    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const dbOrder = await createOrder({
        orderId,
        amount: data.amount,
        currency: 'INR',
        userId: data.userId,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        status: 'CREATED',
    });

    const cfResponse = await createCashfreeOrder({
        amount: data.amount,
        customerId: data.userId,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        orderId: orderId,
    });

    const updatedOrder = await updateOrderByOrderId(orderId, {
        cfOrderId: cfResponse.order_id,
        paymentSessionId: cfResponse.payment_session_id,
        cfOrderStatus: cfResponse.order_status,
        status: 'PENDING',
    });

    return updatedOrder;
};

export const getOrderByIdService = async (orderId: string) => {
    const order = await getOrderByOrderId(orderId);
    if (!order) {
        throw new Error('Order not found');
    }
    return order;
};

export const getPaymentStatusService = async (orderId: string) => {
    const order = await getOrderByOrderId(orderId);
    if (!order) {
        throw new Error('Order not found');
    }


    if (order.cfOrderId) {
        try {

            const paymentStatus = await getCashfreePaymentStatus(order.cfOrderId);


            let finalStatus: 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' = order.status;

            if (paymentStatus.payments && paymentStatus.payments.length > 0) {
                const latestPayment = paymentStatus.payments[0];
                const cfPaymentStatus = latestPayment.payment_status;

                if (cfPaymentStatus === 'SUCCESS') {
                    finalStatus = 'SUCCESS';
                } else if (cfPaymentStatus === 'FAILED') {
                    finalStatus = 'FAILED';
                } else if (cfPaymentStatus === 'PENDING') {
                    finalStatus = 'PENDING';
                }


                if (finalStatus !== order.status) {
                    await updateOrderStatus(orderId, finalStatus, {
                        paymentMethod: latestPayment.payment_method?.payment_method,
                    });
                }
            }


            const cfOrderDetails = await getCashfreeOrder(order.cfOrderId);

            return {
                order: await getOrderByOrderId(orderId),
                cashfreeOrder: cfOrderDetails,
                cashfreePayment: paymentStatus,
            };
        } catch (error) {
            console.error('Error fetching payment status from Cashfree:', error);

            return {
                order,
                error: 'Unable to fetch real-time status from payment gateway',
            };
        }
    }


    return { order };
};


export const syncOrderStatusService = async (orderId: string) => {
    const order = await getOrderByOrderId(orderId);
    if (!order) {
        throw new Error('Order not found');
    }

    if (!order.cfOrderId) {
        throw new Error('No Cashfree order ID found');
    }

    const paymentStatus = await getCashfreePaymentStatus(order.cfOrderId);

    let finalStatus: 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' = order.status;

    if (paymentStatus.payments && paymentStatus.payments.length > 0) {
        const latestPayment = paymentStatus.payments[0];
        const cfPaymentStatus = latestPayment.payment_status;

        if (cfPaymentStatus === 'SUCCESS') {
            finalStatus = 'SUCCESS';
        } else if (cfPaymentStatus === 'FAILED') {
            finalStatus = 'FAILED';
        }

        const updatedOrder = await updateOrderStatus(orderId, finalStatus, {
            paymentMethod: latestPayment.payment_method?.payment_method,
            cfOrderStatus: cfPaymentStatus,
        });

        return updatedOrder;
    }

    return order;
};