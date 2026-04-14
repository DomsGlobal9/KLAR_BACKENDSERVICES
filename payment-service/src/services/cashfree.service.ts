import axios from 'axios';
import { cashfreeConfig } from '../config/cashfree.config';
import { config } from '../config/env.config';
import { ICashfreeOrderResponse } from '../types/cashfree.types';



export const createCashfreeOrder = async (data: {
    amount: number;
    customerId: string;
    customerPhone: string;
}): Promise<ICashfreeOrderResponse> => {
    const orderId = `ORDER_${Date.now()}`;

    const payload = {
        order_id: orderId,
        order_amount: data.amount,
        order_currency: 'INR',
        customer_details: {
            customer_id: data.customerId,
            customer_phone: data.customerPhone,
        },
        order_meta: {
            return_url: `${config.FRONTEND_URL}/payment-status?order_id=${orderId}`,
        },
    };

    try {
        const response = await axios.post<ICashfreeOrderResponse>(
            `${cashfreeConfig.apiUrl}/orders`,
            payload,
            {
                headers: {
                    'x-client-id': cashfreeConfig.appId,
                    'x-client-secret': cashfreeConfig.secretKey,
                    'x-api-version': '2023-08-01',
                    'Content-Type': 'application/json',
                },
            }
        );

        return response.data;
    } catch (error: any) {
        console.error(
            'Cashfree Order Error:',
            error.response?.data || error.message
        );
        throw new Error('Failed to create Cashfree order');
    }
};