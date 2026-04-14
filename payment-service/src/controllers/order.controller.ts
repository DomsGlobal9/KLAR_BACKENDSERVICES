import { Request, Response } from 'express';
import { createOrderService } from '../services/order.service';

export const createOrderController = async (req: Request, res: Response) => {
    try {
        const { amount, userId, customerPhone } = req.body;

        if (!amount || !userId || !customerPhone) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
            });
        }

        const order = await createOrderService({
            amount,
            userId,
            customerPhone,
        });

        return res.status(200).json({
            success: true,
            data: order,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};