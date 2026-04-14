export interface ICashfreeOrderResponse {
    order_id: string;
    payment_session_id: string;
    order_amount: number;
    order_currency: string;
    order_status: string;
}

export interface ICashfreeOrderDetailsResponse {
    order_id: string;
    order_amount: number;
    order_currency: string;
    order_status: string;
    customer_details: {
        customer_id: string;
        customer_email: string;
        customer_phone: string;
        customer_name: string;
    };
    order_meta: {
        return_url: string;
    };
    created_at: string;
}

export interface ICashfreePaymentStatusResponse {
    payments: Array<{
        payment_id: string;
        order_id: string;
        payment_amount: number;
        payment_status: string;
        payment_method: {
            payment_method: string;
            payment_group: string;
        };
        payment_time: string;
    }>;
}