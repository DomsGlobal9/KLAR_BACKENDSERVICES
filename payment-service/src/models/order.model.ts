import mongoose, { Schema, Document } from 'mongoose';

export type OrderStatus = 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type PaymentGateway = 'cashfree' | 'razorpay';
export type PlatformType = 'B2B' | 'B2C';

export interface IOrder extends Document {
    userId: string;
    userEmail: string;
    mobile?: string;
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
        mobile: {
            type: String,
            required: false,
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
            unique: true,
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
            enum: ['CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
            default: 'CREATED',
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
OrderSchema.index({ razorpayOrderId: 1 });
OrderSchema.index({ razorpayPaymentId: 1 });

export const OrderModel = mongoose.model<IOrder>('Order', OrderSchema);

















// import mongoose, { Schema, Document } from 'mongoose';

// export type OrderStatus = 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED';
// export type PaymentGateway = 'cashfree' | 'razorpay';

// export interface IOrder extends Document {
//     userId: string;
//     userEmail: string;
//     mobile?: string;
//     clientType: string;
//     amount: number;
//     currency: string;
//     environment: string;
//     orderId: string;
//     cfOrderId?: string;
//     paymentSessionId?: string;
//     cfOrderStatus?: string;
//     paymentGateway?: PaymentGateway;
//     razorpayOrderId?: string;
//     razorpayPaymentId?: string;
//     status: OrderStatus;
//     createdAt: Date;
//     updatedAt: Date;
// }

// const OrderSchema: Schema = new Schema(
//     {
//         userId: {
//             type: String,
//             required: true,
//         },
//         userEmail: {
//             type: String,
//             required: true,
//         },
//         mobile: {
//             type: String,
//             required: false,
//         },
//         clientType: {
//             type: String,
//             required: true,
//         },
//         amount: {
//             type: Number,
//             required: true,
//         },
//         currency: {
//             type: String,
//             required: true,
//             default: 'INR',
//         },
//         environment: {
//             type: String,
//             required: true,
//             enum: ['sandbox', 'production', 'test', 'live'],
//         },
//         orderId: {
//             type: String,
//             required: true,
//             unique: true,
//         },
//         cfOrderId: {
//             type: String,
//             sparse: true,
//         },
//         paymentSessionId: {
//             type: String,
//         },
//         cfOrderStatus: {
//             type: String,
//         },
//         paymentGateway: {
//             type: String,
//             enum: ['cashfree', 'razorpay'],
//             required: false,
//         },
//         razorpayOrderId: {
//             type: String,
//             sparse: true,
//         },
//         razorpayPaymentId: {
//             type: String,
//         },
//         status: {
//             type: String,
//             enum: ['CREATED', 'PENDING', 'SUCCESS', 'FAILED'],
//             default: 'CREATED',
//         },
//     },
//     {
//         timestamps: true,
//     }
// );


// OrderSchema.index({ userId: 1 });
// OrderSchema.index({ paymentGateway: 1 });
// OrderSchema.index({ status: 1 });

// export const OrderModel = mongoose.model<IOrder>('Order', OrderSchema);