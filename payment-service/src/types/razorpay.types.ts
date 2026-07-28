export interface ICreateRazorpayOrderParams {
    userId: string;
    userEmail: string;
    mobile: string;
    clientType: string;
    amount: number;
    currency?: string;
    platform: 'B2B' | 'B2C';
    bookingId?: string;
    purpose?: string;
}

export interface ICreateRazorpayOrderResponse {
    order: any;
    razorpayOrderId: string;
    razorpayKeyId: string;
    amount: number;
    currency: string;
    platform: 'B2B' | 'B2C';
    bookingId?: string;
}

export interface IVerifyRazorpayPaymentParams {
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    platform?: 'B2B' | 'B2C';
}

export interface IRazorpayOrderResponse {
    id: string;
    entity: string;
    amount: number;
    amount_paid: number;
    amount_due: number;
    currency: string;
    receipt: string;
    status: 'created' | 'paid' | 'attempted' | 'failed';
    attempts: number;
    notes: any;
    created_at: number;
}

export interface IRazorpayPaymentResponse {
    id: string;
    entity: string;
    amount: number;
    currency: string;
    status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
    order_id: string;
    invoice_id: string | null;
    international: boolean;
    method: string;
    amount_refunded: number;
    refund_status: string | null;
    captured: boolean;
    description: string | null;
    card_id: string | null;
    bank: string | null;
    wallet: string | null;
    vpa: string | null;
    email: string;
    contact: string;
    notes: any;
    fee: number | null;
    tax: number | null;
    error_code: string | null;
    error_description: string | null;
    created_at: number;
}

export interface IRazorpayWebhookPayload {
    event: string;
    payload: {
        payment: {
            entity: IRazorpayPaymentResponse;
        };
        order: {
            entity: IRazorpayOrderResponse;
        };
    };
    created_at: number;
}

export interface IWebhookPaymentData {
    event: string;
    payload: {
        payment: {
            entity: IRazorpayPaymentResponse;
        };
        order?: {
            entity: IRazorpayOrderResponse;
        };
    };
    created_at: number;
}








// export interface ICreateRazorpayOrderParams {
//     userId: string;
//     userEmail: string;
//     mobile: string;
//     clientType: string;
//     amount: number;
//     currency?: string;
// }

// export interface ICreateRazorpayOrderResponse {
//     order: any;
//     razorpayOrderId: string;
//     razorpayKeyId: string;
//     amount: number;
//     currency: string;
// }

// export interface IVerifyRazorpayPaymentParams {
//     orderId: string;
//     razorpayOrderId: string;
//     razorpayPaymentId: string;
//     razorpaySignature: string;
// }

// export interface IRazorpayOrderResponse {
//     id: string;
//     entity: string;
//     amount: number;
//     amount_paid: number;
//     amount_due: number;
//     currency: string;
//     receipt: string;
//     status: 'created' | 'paid' | 'attempted' | 'failed';
//     attempts: number;
//     notes: any;
//     created_at: number;
// }

// export interface IRazorpayPaymentResponse {
//     id: string;
//     entity: string;
//     amount: number;
//     currency: string;
//     status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
//     order_id: string;
//     invoice_id: string | null;
//     international: boolean;
//     method: string;
//     amount_refunded: number;
//     refund_status: string | null;
//     captured: boolean;
//     description: string | null;
//     card_id: string | null;
//     bank: string | null;
//     wallet: string | null;
//     vpa: string | null;
//     email: string;
//     contact: string;
//     notes: any;
//     fee: number | null;
//     tax: number | null;
//     error_code: string | null;
//     error_description: string | null;
//     created_at: number;
// }


// export interface IRazorpayWebhookPayload {
//     event: string;
//     payload: {
//         payment: {
//             entity: IRazorpayPaymentResponse;
//         };
//         order: {
//             entity: IRazorpayOrderResponse;
//         };
//     };
//     created_at: number;
// }

// export interface IWebhookPaymentData {
//     event: string;
//     payload: {
//         payment: {
//             entity: IRazorpayPaymentResponse;
//         };
//         order?: {
//             entity: IRazorpayOrderResponse;
//         };
//     };
//     created_at: number;
// }