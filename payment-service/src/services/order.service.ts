import {
    createOrder,
    updateOrderByOrderId,
    getOrderByOrderId,
    updateOrderStatus,
    getOrderByBookingId
} from '../repositories/order.repository';
import { createCashfreeOrder, getCashfreeOrder, getCashfreePaymentStatus } from './cashfree.service';



export const createOrderService = async (data: {
    userId: string;
    userEmail: string;
    mobile: string;
    clientType: string;
    amount: number;
    currency: string;
    environment: string;
    bookingId?: string;
}) => {


    
    if (data.clientType === 'B2C' && !data.bookingId) {
        throw new Error('bookingId is required for B2C client type');
    }

    
    if (data.bookingId) {
        const existingOrder = await getOrderByBookingId(data.bookingId);

        if (existingOrder && existingOrder.status !== 'SUCCESS' && existingOrder.status !== 'FAILED') {
            const updatedOrder = await updateOrderByOrderId(existingOrder.orderId, {
                userId: data.userId,
                userEmail: data.userEmail,
                mobile: data.mobile,
                clientType: data.clientType,
                amount: data.amount,
                currency: data.currency,
                environment: data.environment,
            });

            if (updatedOrder && updatedOrder.cfOrderId) {
                try {
                    const cfResponse = await createCashfreeOrder({
                        amount: data.amount,
                        customerId: data.userId,
                        customerEmail: data.userEmail,
                        customer_phone: data.mobile,
                        orderId: updatedOrder.orderId,
                        environment: data.environment
                    });

                    await updateOrderByOrderId(updatedOrder.orderId, {
                        cfOrderId: cfResponse.order_id,
                        paymentSessionId: cfResponse.payment_session_id,
                        cfOrderStatus: cfResponse.order_status,
                        status: 'PENDING',
                    });
                } catch (error) {

                }
            }

            const finalOrder = await getOrderByOrderId(existingOrder.orderId);
            return finalOrder;
        }
    }

    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const orderData: any = {
        orderId,
        userId: data.userId,
        userEmail: data.userEmail,
        mobile: data.mobile,
        clientType: data.clientType,
        amount: data.amount,
        currency: data.currency,
        environment: data.environment,
        status: 'CREATED',
    };

    if (data.bookingId) {
        orderData.bookingId = data.bookingId;
    }

    await createOrder(orderData);

    const cfResponse = await createCashfreeOrder({
        amount: data.amount,
        customerId: data.userId,
        customerEmail: data.userEmail,
        customer_phone: data.mobile,
        orderId: orderId,
        environment: data.environment
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
            let finalStatus: 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' = order.status;

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
                    await updateOrderStatus(orderId, finalStatus);
                }
            }

            const cfOrderDetails = await getCashfreeOrder(order.cfOrderId);

            return {
                order: await getOrderByOrderId(orderId),
                cashfreeOrder: cfOrderDetails,
                cashfreePayment: paymentStatus,
            };
        } catch (error) {

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


    let status: 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' = order.status;

    // Check if paymentStatus is an array and has elements
    if (Array.isArray(paymentStatus) && paymentStatus.length > 0) {
        const latestPayment = paymentStatus[0];
        const cfPaymentStatus = latestPayment.payment_status;



        if (cfPaymentStatus === 'SUCCESS') {
            status = 'SUCCESS';
        } else if (cfPaymentStatus === 'FAILED') {
            status = 'FAILED';
        }

        const updatedOrder = await updateOrderStatus(orderId, status);
        return updatedOrder;
    }

    return order;
};