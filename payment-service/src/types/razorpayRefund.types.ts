export interface ICreateRefundParams {
    paymentId: string;
    orderId?: string;
    amount?: number;
    reason?: string;
    notes?: Record<string, any>;
}

export interface IRefundResponse {
    refundId: string;
    razorpayRefundId: string;
    paymentId: string;
    amount: number;
    currency: string;
    status: 'pending' | 'processed' | 'failed' | 'cancelled';
    reason?: string;
    notes?: Record<string, any>;
    processedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface IRazorpayRefundResponse {
    id: string;
    entity: string;
    amount: number;
    currency: string;
    payment_id: string;
    status: 'pending' | 'processed' | 'failed' | 'cancelled';
    created_at: number;
    notes?: Record<string, any>;
}