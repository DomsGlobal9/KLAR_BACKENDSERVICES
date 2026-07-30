import axios from 'axios';
import { cashfreeConfig } from '../config/cashfree.config';
import { config } from '../config/env.config';
import {
    ICashfreeOrderResponse,
    ICashfreeOrderDetailsResponse,
    ICashfreePaymentStatusResponse
} from '../types/cashfree.types';

const getHeaders = () => ({
    'x-client-id': cashfreeConfig.appId,
    'x-client-secret': cashfreeConfig.secretKey,
    'x-api-version': '2023-08-01',
    'Content-Type': 'application/json',
});

export const createCashfreeOrder = async (data: {
    amount: number;
    customerId: string;
    customer_phone: string;
    customerEmail: string;
    orderId: string;
    environment: string;
}): Promise<ICashfreeOrderResponse> => {


    const apiUrl = data.environment === 'sandbox'
        ? 'https://sandbox.cashfree.com/pg'
        : 'https://api.cashfree.com/pg';

    const payload = {
        order_id: data.orderId,
        order_amount: data.amount,
        order_currency: 'INR',
        customer_details: {
            customer_id: data.customerId,
            customer_email: data.customerEmail,
            customer_phone: data.customer_phone,
        },
        order_meta: {
            return_url: `${config.FRONTEND_URL}/payment-status?order_id=${data.orderId}`,
        },
    };

    try {
        const response = await axios.post<ICashfreeOrderResponse>(
            `${apiUrl}/orders`,
            payload,
            { headers: getHeaders() }
        );

        return response.data;
    } catch (error: any) {

        throw new Error(error.response?.data?.message || 'Failed to create Cashfree order');
    }
};

export const getCashfreeOrder = async (cfOrderId: string): Promise<ICashfreeOrderDetailsResponse> => {
    try {
        const response = await axios.get<ICashfreeOrderDetailsResponse>(
            `${cashfreeConfig.apiUrl}/orders/${cfOrderId}`,
            { headers: getHeaders() }
        );

        return response.data;
    } catch (error: any) {

        throw new Error('Failed to fetch Cashfree order details');
    }
};

export const getCashfreePaymentStatus = async (cfOrderId: string): Promise<ICashfreePaymentStatusResponse> => {
    try {
        const response = await axios.get<ICashfreePaymentStatusResponse>(
            `${cashfreeConfig.apiUrl}/orders/${cfOrderId}/payments`,
            { headers: getHeaders() }
        );

        // console.log("THe cashfree update ");

        return response.data;
    } catch (error: any) {

        throw new Error('Failed to fetch payment status');
    }
};