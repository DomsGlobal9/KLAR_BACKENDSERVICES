import mongoose, { Schema, Document } from 'mongoose';

export type OrderStatus = 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
export type PaymentGateway = 'cashfree' | 'razorpay';
export type PlatformType = 'B2B' | 'B2C';
export type RefundStatus = 'pending' | 'processed' | 'failed' | 'cancelled';

export interface IRefund {
    refundId: string;
    razorpayRefundId: string;
    paymentId: string;
    amount: number;
    currency: string;
    status: RefundStatus;
    reason?: string;
    notes?: Record<string, any>;
    processedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface IOrder extends Document {
    userId: string;
    userEmail: string;
    mobile?: string;
    bookingId?: string;
    clientType: string;
    amount: number;
    currency: string;
    environment: string;
    orderId: string;
    cfOrderId?: string;
    paymentSessionId?: string;
    cfOrderStatus?: string;
    paymentGateway?: PaymentGateway;
    platform: PlatformType;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    status: OrderStatus;
    refunds: IRefund[];
    totalRefundedAmount: number;
    createdAt: Date;
    updatedAt: Date;
}

const RefundSchema: Schema = new Schema(
    {
        refundId: {
            type: String,
            required: true,
        },
        razorpayRefundId: {
            type: String,
            required: true,
        },
        paymentId: {
            type: String,
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            required: true,
            default: 'INR',
        },
        status: {
            type: String,
            enum: ['pending', 'processed', 'failed', 'cancelled'],
            default: 'pending',
        },
        reason: {
            type: String,
        },
        notes: {
            type: Schema.Types.Mixed,
        },
        processedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);


RefundSchema.index({ refundId: 1 }, { unique: true });
RefundSchema.index({ razorpayRefundId: 1 }, { unique: true });

const OrderSchema: Schema = new Schema(
    {
        userId: {
            type: String,
            required: true,
        },
        userEmail: {
            type: String,
            required: true,
        },
        mobile: {
            type: String,
            required: false,
        },
        bookingId: {
            type: String,
        },
        clientType: {
            type: String,
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            required: true,
            default: 'INR',
        },
        environment: {
            type: String,
            required: true,
            enum: ['sandbox', 'production', 'test', 'live'],
        },
        orderId: {
            type: String,
            required: true,
        },
        cfOrderId: {
            type: String,
            sparse: true,
        },
        paymentSessionId: {
            type: String,
        },
        cfOrderStatus: {
            type: String,
        },
        paymentGateway: {
            type: String,
            enum: ['cashfree', 'razorpay'],
            required: false,
        },
        platform: {
            type: String,
            enum: ['B2B', 'B2C'],
            required: true,
            default: 'B2B',
        },
        razorpayOrderId: {
            type: String,
            sparse: true,
        },
        razorpayPaymentId: {
            type: String,
        },
        status: {
            type: String,
            enum: ['CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
            default: 'CREATED',
        },
        refunds: [RefundSchema],
        totalRefundedAmount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);


OrderSchema.index({ userId: 1 });
OrderSchema.index({ paymentGateway: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ platform: 1 });
OrderSchema.index({ razorpayPaymentId: 1 });
OrderSchema.index({ cfOrderId: 1 });


OrderSchema.index({ razorpayOrderId: 1 }, { 
    unique: true, 
    sparse: true,
    background: true 
});

OrderSchema.index({ bookingId: 1 }, { 
    unique: true,
    sparse: true,
    background: true 
});

OrderSchema.index({ orderId: 1 }, { 
    unique: true,
    background: true 
});


OrderSchema.index({ userId: 1, status: 1 });
OrderSchema.index({ platform: 1, status: 1 });

export const OrderModel = mongoose.model<IOrder>('Order', OrderSchema);