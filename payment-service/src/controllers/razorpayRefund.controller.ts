import { Request, Response } from 'express';
import {
    createRefundService,
    getRefundByRefundIdService,
    getRefundsByPaymentIdService,
    getRefundsByOrderIdService,
    updateRefundStatusService,
    getRefundByRazorpayRefundIdService,
    getAllRefundsByUserIdService,
    fetchRefundFromRazorpayService,
    fetchAllRefundsFromRazorpayService,
    updateRefundNotesService,
    createRefundByBookingIdService
} from '../services/razorpayRefund.service';
import {
    validatePaymentIdParam,
    validateOrderIdParam
} from '../utils/validator/razorpay.validation';

export const createRefundController = async (req: Request, res: Response) => {
    try {
        const { paymentId, orderId, amount, reason, notes } = req.body;

        if (!paymentId) {
            return res.status(400).json({
                success: false,
                message: 'paymentId is required'
            });
        }

        if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'amount must be a positive number when provided'
            });
        }

        const refund = await createRefundService({
            paymentId,
            orderId,
            amount,
            reason,
            notes
        });

        return res.status(200).json({
            success: true,
            message: 'Refund processed successfully',
            data: refund
        });

    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to process refund'
        });
    }
};

export const createRefundByBookingIdController = async (req: Request, res: Response) => {
    try {
        const { bookingId, amount } = req.body;

        if (!bookingId) {
            return res.status(400).json({
                success: false,
                message: '[CONTROLLER] Booking Id is required'
            });
        }

        if (!amount) {
            return res.status(400).json({
                success: false,
                message: '[CONTROLLER] Amount is required'
            });
        }

        const refund = await createRefundByBookingIdService(
            bookingId,
            amount
        );

        return res.status(200).json({
            success: true,
            message: 'Refund processed successfully',
            data: refund
        });

    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to process refund'
        });
    }
};

export const getRefundByRefundIdController = async (req: Request, res: Response) => {
    try {
        const { refundId } = req.params;

        const error = validatePaymentIdParam(refundId as string);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error
            });
        }

        const refund = await getRefundByRefundIdService(refundId as string);

        return res.status(200).json({
            success: true,
            data: refund
        });

    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch refund'
        });
    }
};

export const getRefundsByPaymentIdController = async (req: Request, res: Response) => {
    try {
        const { paymentId } = req.params;

        const error = validatePaymentIdParam(paymentId as string);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error
            });
        }

        const refunds = await getRefundsByPaymentIdService(paymentId as string);

        return res.status(200).json({
            success: true,
            data: refunds
        });

    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch refunds'
        });
    }
};

export const getRefundsByOrderIdController = async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;

        const error = validateOrderIdParam(orderId as string);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error
            });
        }

        const refunds = await getRefundsByOrderIdService(orderId as string);

        return res.status(200).json({
            success: true,
            data: refunds
        });

    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch refunds'
        });
    }
};

export const updateRefundStatusController = async (req: Request, res: Response) => {
    try {
        const { refundId } = req.params;
        const { status, notes } = req.body;

        const error = validatePaymentIdParam(refundId as string);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error
            });
        }

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'status is required'
            });
        }

        const validStatuses = ['pending', 'processed', 'failed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `status must be one of ${validStatuses.join(', ')}`
            });
        }

        const refund = await updateRefundStatusService(refundId as string, status, { notes });

        return res.status(200).json({
            success: true,
            message: 'Refund status updated successfully',
            data: refund
        });

    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to update refund status'
        });
    }
};

export const getRefundByRazorpayRefundIdController = async (req: Request, res: Response) => {
    try {
        const { razorpayRefundId } = req.params;

        if (!razorpayRefundId) {
            return res.status(400).json({
                success: false,
                message: 'razorpayRefundId is required'
            });
        }

        const refund = await getRefundByRazorpayRefundIdService(razorpayRefundId as string);

        return res.status(200).json({
            success: true,
            data: refund
        });

    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch refund'
        });
    }
};

export const getAllRefundsByUserIdController = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = parseInt(req.query.skip as string) || 0;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'userId is required'
            });
        }

        const refunds = await getAllRefundsByUserIdService(userId as string, limit, skip);

        return res.status(200).json({
            success: true,
            data: refunds,
            pagination: {
                limit,
                skip
            }
        });

    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch refunds'
        });
    }
};

export const fetchRefundFromRazorpayController = async (req: Request, res: Response) => {
    try {
        const { refundId } = req.params;
        const { platform } = req.query;

        if (!refundId) {
            return res.status(400).json({
                success: false,
                message: 'refundId is required'
            });
        }

        const refund = await fetchRefundFromRazorpayService(
            refundId as string,
            platform as 'B2B' | 'B2C'
        );

        return res.status(200).json({
            success: true,
            data: refund
        });

    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch refund from Razorpay'
        });
    }
};

export const fetchAllRefundsFromRazorpayController = async (req: Request, res: Response) => {
    try {
        const { platform, from, to, count, skip } = req.query;

        const refunds = await fetchAllRefundsFromRazorpayService(
            platform as 'B2B' | 'B2C',
            from ? parseInt(from as string) : undefined,
            to ? parseInt(to as string) : undefined,
            count ? parseInt(count as string) : undefined,
            skip ? parseInt(skip as string) : undefined
        );

        return res.status(200).json({
            success: true,
            data: refunds
        });

    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch refunds from Razorpay'
        });
    }
};

export const updateRefundNotesController = async (req: Request, res: Response) => {
    try {
        const { refundId } = req.params;
        const { notes, platform } = req.body;

        if (!refundId) {
            return res.status(400).json({
                success: false,
                message: 'refundId is required'
            });
        }

        if (!notes || typeof notes !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'notes object is required'
            });
        }

        const updatedRefund = await updateRefundNotesService(
            refundId as string,
            notes,
            platform as 'B2B' | 'B2C'
        );

        return res.status(200).json({
            success: true,
            message: 'Refund notes updated successfully',
            data: updatedRefund
        });

    } catch (error: any) {

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to update refund notes'
        });
    }
};