import { Request, Response } from 'express';
import {
    createRazorpayOrderService,
    verifyRazorpayPaymentService,
    getRazorpayOrderService,    
    syncRazorpayOrderStatusService,
    getRazorpayPaymentStatusService,
    getRazorpayOrderDetailsService,
    razorpayWebhookService,
    refundRazorpayPaymentService,
    verifyPaymentForBookingService
} from '../services/razorpay.service';

import {
    validateCreateOrder,
    validateVerifyPayment,
    validateOrderIdParam,
    validatePaymentIdParam,
    validateRazorpayOrderIdParam
} from '../utils/validator/razorpay.validation';


export const createRazorpayOrderController = async (req: Request, res: Response) => {
    try {
        const error = validateCreateOrder(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const { userId, userEmail, mobile, clientType, amount, currency = 'INR', platform, bookingId } = req.body;

        if (!platform || !['B2B', 'B2C'].includes(platform)) {
            return res.status(400).json({
                success: false,
                message: 'platform must be B2B or B2C'
            });
        }


        const result = await createRazorpayOrderService({
            userId,
            userEmail,
            mobile,
            clientType,
            amount,
            currency,
            platform,
            bookingId 
        });

        return res.status(200).json({
            success: true,
            message: 'Razorpay order created successfully',
            data: result,
        });
    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to create Razorpay order',
        });
    }
};

export const verifyRazorpayPaymentController = async (req: Request, res: Response) => {
    try {
        const error = validateVerifyPayment(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const result = await verifyRazorpayPaymentService(req.body);

        return res.status(200).json({
            success: true,
            message: 'Payment verified successfully',
            data: result,
        });
    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to verify payment',
        });
    }
};

export const getRazorpayOrderController = async (req: Request, res: Response) => {
    try {
        const error = validateOrderIdParam(req.params.orderId as string);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const order = await getRazorpayOrderService(req.params.orderId as string);

        return res.status(200).json({
            success: true,
            data: order,
        });
    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch order',
        });
    }
};

export const syncRazorpayOrderStatusController = async (req: Request, res: Response) => {
    try {
        const error = validateOrderIdParam(req.params.orderId as string);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const updatedOrder = await syncRazorpayOrderStatusService(req.params.orderId as string);

        return res.status(200).json({
            success: true,
            message: 'Order status synced successfully',
            data: updatedOrder,
        });
    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to sync order status',
        });
    }
};

export const getRazorpayPaymentStatusController = async (req: Request, res: Response) => {
    try {
        const error = validatePaymentIdParam(req.params.paymentId as string);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const platform = req.query.platform as 'B2B' | 'B2C' | undefined;
        const paymentStatus = await getRazorpayPaymentStatusService(req.params.paymentId as string, platform);

        return res.status(200).json({
            success: true,
            data: paymentStatus,
        });
    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch payment status',
        });
    }
};

/**
 * Refund a captured Razorpay payment. Service-to-service only.
 *
 * Callers are responsible for not asking twice: Razorpay will happily issue a
 * second refund against the same payment. The booking services claim a refund
 * on their own record before calling this.
 */
export const refundRazorpayPaymentController = async (req: Request, res: Response) => {
    try {
        const { paymentId, amount, notes, platform } = req.body;

        const error = validatePaymentIdParam(paymentId);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'amount must be a positive number when provided'
            });
        }

        if (platform !== undefined && !['B2B', 'B2C'].includes(platform)) {
            return res.status(400).json({
                success: false,
                message: "platform must be 'B2B' or 'B2C' when provided"
            });
        }

        const refund = await refundRazorpayPaymentService(paymentId, amount, notes, platform);

        return res.status(200).json({
            success: true,
            data: refund,
        });
    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error?.error?.description || error.message || 'Failed to refund payment',
        });
    }
};

/**
 * Verify a captured payment for a booking service. Service-to-service only
 * (guarded by internalServiceAuth). Returns whether the payment is genuinely
 * captured, belongs to the expected order, and covers the expected amount.
 */
export const verifyPaymentInternalController = async (req: Request, res: Response) => {
    try {
        const { paymentId, orderId, expectedAmount, platform } = req.body;

        const error = validatePaymentIdParam(paymentId);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }
        if (expectedAmount !== undefined && (typeof expectedAmount !== 'number' || expectedAmount < 0)) {
            return res.status(400).json({ success: false, message: 'expectedAmount must be a non-negative number when provided' });
        }
        if (platform !== undefined && !['B2B', 'B2C'].includes(platform)) {
            return res.status(400).json({ success: false, message: "platform must be 'B2B' or 'B2C' when provided" });
        }

        const result = await verifyPaymentForBookingService({ paymentId, orderId, expectedAmount, platform });

        return res.status(200).json({ success: true, data: result });
    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to verify payment',
        });
    }
};

export const getRazorpayOrderDetailsController = async (req: Request, res: Response) => {
    try {
        const error = validateRazorpayOrderIdParam(req.params.razorpayOrderId as string);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const platform = req.query.platform as 'B2B' | 'B2C' | undefined;
        const orderDetails = await getRazorpayOrderDetailsService(req.params.razorpayOrderId as string, platform);

        return res.status(200).json({
            success: true,
            data: orderDetails,
        });
    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch order details',
        });
    }
};

export const razorpayWebhookController = async (
    req: Request,
    res: Response
) => {
    try {


        const signature = req.headers['x-razorpay-signature'] as string;



        const rawBody = req.body.toString();



        const parsedBody = JSON.parse(rawBody);

        console.log(
            'Webhook Event:',
            parsedBody?.event
        );

        console.log(
            'Razorpay Order ID:',
            parsedBody?.payload?.payment?.entity?.order_id
        );

        await razorpayWebhookService(rawBody, signature);



        return res.status(200).json({
            success: true,
        });

    } catch (error: any) {



        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

export const testWebhookController = async (req: Request, res: Response) => {
    try {
        const testPayload = req.body;
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

        if (!secret) {
            return res.status(500).json({
                success: false,
                message: 'RAZORPAY_WEBHOOK_SECRET not configured'
            });
        }

        const rawBody = JSON.stringify(testPayload);
        const crypto = require('crypto');
        const generatedSignature = crypto
            .createHmac('sha256', secret)
            .update(rawBody)
            .digest('hex');

        const result = await razorpayWebhookService(rawBody, generatedSignature);

        return res.status(200).json({
            success: true,
            message: 'Test webhook processed',
            data: result
        });

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
















// import { Request, Response } from 'express';
// import {
//     createRazorpayOrderService,
//     verifyRazorpayPaymentService,
//     getRazorpayOrderService,
//     syncRazorpayOrderStatusService,
//     getRazorpayPaymentStatusService,
//     getRazorpayOrderDetailsService,
//     razorpayWebhookService
// } from '../services/razorpay.service';

// import {
//     validateCreateOrder,
//     validateVerifyPayment,
//     validateOrderIdParam,
//     validatePaymentIdParam,
//     validateRazorpayOrderIdParam
// } from '../utils/validator/razorpay.validation';

// export const createRazorpayOrderController = async (req: Request, res: Response) => {
//     try {
//         const error = validateCreateOrder(req.body);
//         if (error) {
//             return res.status(400).json({ success: false, message: error });
//         }

//         const { userId, userEmail, mobile, clientType, amount, currency = 'INR' } = req.body;

//         const result = await createRazorpayOrderService({
//             userId,
//             userEmail,
//             mobile,
//             clientType,
//             amount,
//             currency
//         });

//         return res.status(200).json({
//             success: true,
//             message: 'Razorpay order created successfully',
//             data: result,
//         });
//     } catch (error: any) {
//         console.error('Create Razorpay order controller error:', error);
//         return res.status(500).json({
//             success: false,
//             message: error.message || 'Failed to create Razorpay order',
//         });
//     }
// };

// export const verifyRazorpayPaymentController = async (req: Request, res: Response) => {
//     try {
//         const error = validateVerifyPayment(req.body);
//         if (error) {
//             return res.status(400).json({ success: false, message: error });
//         }

//         const result = await verifyRazorpayPaymentService(req.body);

//         return res.status(200).json({
//             success: true,
//             message: 'Payment verified successfully',
//             data: result,
//         });
//     } catch (error: any) {
//         console.error('Verify Razorpay payment controller error:', error);
//         return res.status(500).json({
//             success: false,
//             message: error.message || 'Failed to verify payment',
//         });
//     }
// };

// export const getRazorpayOrderController = async (req: Request, res: Response) => {
//     try {
//         const error = validateOrderIdParam(req.params.orderId as string);
//         if (error) {
//             return res.status(400).json({ success: false, message: error });
//         }

//         const order = await getRazorpayOrderService(req.params.orderId as string);

//         return res.status(200).json({
//             success: true,
//             data: order,
//         });
//     } catch (error: any) {
//         console.error('Get Razorpay order controller error:', error);
//         return res.status(500).json({
//             success: false,
//             message: error.message || 'Failed to fetch order',
//         });
//     }
// };

// export const syncRazorpayOrderStatusController = async (req: Request, res: Response) => {
//     try {
//         const error = validateOrderIdParam(req.params.orderId as string);
//         if (error) {
//             return res.status(400).json({ success: false, message: error });
//         }

//         const updatedOrder = await syncRazorpayOrderStatusService(req.params.orderId as string);

//         return res.status(200).json({
//             success: true,
//             message: 'Order status synced successfully',
//             data: updatedOrder,
//         });
//     } catch (error: any) {
//         console.error('Sync Razorpay order status controller error:', error);
//         return res.status(500).json({
//             success: false,
//             message: error.message || 'Failed to sync order status',
//         });
//     }
// };

// export const getRazorpayPaymentStatusController = async (req: Request, res: Response) => {
//     try {
//         const error = validatePaymentIdParam(req.params.paymentId as string);
//         if (error) {
//             return res.status(400).json({ success: false, message: error });
//         }

//         const paymentStatus = await getRazorpayPaymentStatusService(req.params.paymentId as string);

//         return res.status(200).json({
//             success: true,
//             data: paymentStatus,
//         });
//     } catch (error: any) {
//         console.error('Get Razorpay payment status controller error:', error);
//         return res.status(500).json({
//             success: false,
//             message: error.message || 'Failed to fetch payment status',
//         });
//     }
// };

// export const getRazorpayOrderDetailsController = async (req: Request, res: Response) => {
//     try {
//         const error = validateRazorpayOrderIdParam(req.params.razorpayOrderId as string);
//         if (error) {
//             return res.status(400).json({ success: false, message: error });
//         }

//         const orderDetails = await getRazorpayOrderDetailsService(req.params.razorpayOrderId as string);

//         return res.status(200).json({
//             success: true,
//             data: orderDetails,
//         });
//     } catch (error: any) {
//         console.error('Get Razorpay order details controller error:', error);
//         return res.status(500).json({
//             success: false,
//             message: error.message || 'Failed to fetch order details',
//         });
//     }
// };

// export const razorpayWebhookController = async (
//     req: Request,
//     res: Response
// ) => {
//     try {

//         console.log('================ RAZORPAY WEBHOOK START ================');

//         const signature = req.headers['x-razorpay-signature'] as string;

//         console.log('Signature received:', signature);

//         const rawBody = req.body.toString();

//         console.log('Raw Body:', rawBody);

//         const parsedBody = JSON.parse(rawBody);

//         console.log(
//             'Webhook Event:',
//             parsedBody?.event
//         );

//         console.log(
//             'Razorpay Order ID:',
//             parsedBody?.payload?.payment?.entity?.order_id
//         );

//         await razorpayWebhookService(rawBody, signature);

//         console.log('✅ Webhook processed successfully');

//         return res.status(200).json({
//             success: true,
//         });

//     } catch (error: any) {

//         console.error('❌ Webhook Error:', error.message);

//         return res.status(400).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// export const testWebhookController = async (req: Request, res: Response) => {
//     try {
//         const testPayload = req.body;
//         const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

//         if (!secret) {
//             return res.status(500).json({
//                 success: false,
//                 message: 'RAZORPAY_WEBHOOK_SECRET not configured'
//             });
//         }

//         const rawBody = JSON.stringify(testPayload);
//         const crypto = require('crypto');
//         const generatedSignature = crypto
//             .createHmac('sha256', secret)
//             .update(rawBody)
//             .digest('hex');

//         const result = await razorpayWebhookService(rawBody, generatedSignature);

//         return res.status(200).json({
//             success: true,
//             message: 'Test webhook processed',
//             data: result
//         });

//     } catch (error: any) {
//         return res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };