import { Request, Response } from 'express';
import {
    createOrderService,
    getOrderByIdService,
    getPaymentStatusService,
    syncOrderStatusService
} from '../services/order.service';

export const createOrderController = async (req: Request, res: Response) => {
    try {
        const {
            userId,
            userEmail,
            mobile,
            clientType,
            amount,
            currency,
            environment
        } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'userId is required',
            });
        }

        if (!userEmail) {
            return res.status(400).json({
                success: false,
                message: 'userEmail is required',
            });
        }

        if (!mobile) {
            return res.status(400).json({
                success: false,
                message: 'mobile is required',
            });
        }

        if (!clientType) {
            return res.status(400).json({
                success: false,
                message: 'clientType is required',
            });
        }

        if (!amount) {
            return res.status(400).json({
                success: false,
                message: 'amount is required',
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be greater than 0',
            });
        }

        if (!currency) {
            return res.status(400).json({
                success: false,
                message: 'currency is required',
            });
        }

        if (!environment) {
            return res.status(400).json({
                success: false,
                message: 'environment is required',
            });
        }

        if (!['sandbox', 'production'].includes(environment)) {
            return res.status(400).json({
                success: false,
                message: 'environment must be either sandbox or production',
            });
        }

        const order = await createOrderService({
            userId,
            userEmail,
            mobile,
            clientType,
            amount,
            currency,
            environment
        });

        return res.status(200).json({
            success: true,
            message: 'Order created successfully',
            data: order,
        });
    } catch (error: any) {
        console.error('Create order error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to create order',
        });
    }
};

export const getOrderController = async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required',
            });
        }

        const order = await getOrderByIdService(orderId as string);

        return res.status(200).json({
            success: true,
            data: order,
        });
    } catch (error: any) {
        console.error('Get order error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch order',
        });
    }
};

export const getPaymentStatusController = async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required',
            });
        }

        const paymentStatus = await getPaymentStatusService(orderId as string);

        const isSuccess = paymentStatus.order?.status === 'SUCCESS';

        return res.status(200).json({
            success: true,
            data: {
                orderId,
                status: paymentStatus.order?.status,
                isSuccess,
                paymentDetails: paymentStatus.cashfreePayment,
                orderDetails: paymentStatus.order,
            },
        });
    } catch (error: any) {
        console.error('Get payment status error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch payment status',
        });
    }
};

export const syncOrderStatusController = async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required',
            });
        }

        const updatedOrder = await syncOrderStatusService(orderId as string);

        return res.status(200).json({
            success: true,
            message: 'Order status synced successfully',
            data: updatedOrder,
        });
    } catch (error: any) {
        console.error('Sync order status error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to sync order status',
        });
    }
};