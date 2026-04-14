import mongoose, { Schema, Document } from 'mongoose';

export type OrderStatus = 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED';

export interface IOrder extends Document {
    orderId: string;
    cfOrderId?: string;
    paymentSessionId?: string;
    amount: number;
    currency: string;
    userId: string;
    customerPhone: string;
    customerEmail?: string;
    customerName?: string;
    status: OrderStatus;
    paymentMethod?: string;
    cfOrderStatus?: string;
    cfPaymentSessionId?: string;
    createdAt: Date;
    updatedAt: Date;
}

const OrderSchema: Schema = new Schema(
    {
        orderId: {
            type: String,
            required: true,
            unique: true,
        },
        cfOrderId: {
            type: String,
        },
        paymentSessionId: {
            type: String,
        },
        amount: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            default: 'INR',
        },
        userId: {
            type: String,
            required: true,
        },
        customerPhone: {
            type: String,
            required: true,
        },
        customerEmail: {
            type: String,
        },
        customerName: {
            type: String,
        },
        status: {
            type: String,
            enum: ['CREATED', 'PENDING', 'SUCCESS', 'FAILED'],
            default: 'CREATED',
        },
        paymentMethod: {
            type: String,
        },
        cfOrderStatus: {
            type: String,
        },
        cfPaymentSessionId: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

OrderSchema.index({ orderId: 1 });
OrderSchema.index({ cfOrderId: 1 });
OrderSchema.index({ userId: 1 });

export const OrderModel = mongoose.model<IOrder>('Order', OrderSchema);