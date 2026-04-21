import mongoose, { Schema, Document } from 'mongoose';

export type OrderStatus = 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED';

export interface IOrder extends Document {
    userId: string;
    userEmail: string;
    clientType: string;
    amount: number;
    currency: string;
    environment: string;
    orderId: string;
    cfOrderId?: string;
    paymentSessionId?: string;
    status: OrderStatus;
    cfOrderStatus?: string;
    createdAt: Date;
    updatedAt: Date;
}

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
            enum: ['sandbox', 'production'],
        },
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
        status: {
            type: String,
            enum: ['CREATED', 'PENDING', 'SUCCESS', 'FAILED'],
            default: 'CREATED',
        },
        cfOrderStatus: {
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