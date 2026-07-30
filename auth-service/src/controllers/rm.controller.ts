import { Request, Response, NextFunction } from "express";

import { Roles } from "../constants/roles";

import { RMService } from "../services/rm.service";
import { OTPService } from "../services/otp.service";

import { OTPType } from "../models/otp.model";
import { AuthenticatedRequest } from "../middlewares/authentication.middleware";

export const createRM = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {

    try {



        const {
            memberName,
            email,
            password,
            mobile,
            role,
        } = req.body;

        /**
         * Validations
         */
        if (!memberName) {
            return res.status(400).json({
                success: false,
                message: "Member name is required",
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required",
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                message: "Password is required",
            });
        }

        if (!mobile) {
            return res.status(400).json({
                success: false,
                message: "Mobile is required",
            });
        }

        if (!role) {
            return res.status(400).json({
                success: false,
                message: "Role is required",
            });
        }

        if (role !== Roles.RM) {
            return res.status(400).json({
                success: false,
                message: "Invalid role",
            });
        }

        /**
         * Check RM existence before OTP
         */
        await RMService.validateRMCreation(email, role);

        /**
         * Send OTP
         */
        await OTPService.generateOTP(
            email.toLowerCase(),
            OTPType.SIGNUP
        );

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
            data: {
                email,
            },
        });

    } catch (err) {
        next(err);
    }
};

export const verifyCreateRMOTP = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {

    try {
        const {
            memberName,
            email,
            password,
            mobile,
            role,
            otp,
        } = req.body;

        /**
         * Validations
         */
        if (!memberName) {
            return res.status(400).json({
                success: false,
                message: "Member name is required",
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required",
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                message: "Password is required",
            });
        }

        if (!mobile) {
            return res.status(400).json({
                success: false,
                message: "Mobile is required",
            });
        }

        if (!role) {
            return res.status(400).json({
                success: false,
                message: "Role is required",
            });
        }

        if (!otp) {
            return res.status(400).json({
                success: false,
                message: "OTP is required",
            });
        }

        if (role !== Roles.RM) {
            return res.status(400).json({
                success: false,
                message: "Invalid role",
            });
        }

        /**
         * Verify OTP
         */
        await OTPService.verifyOTP(
            email.toLowerCase(),
            otp,
            OTPType.SIGNUP
        );

        const currentUser = (req as any).user;

        /**
         * Create RM
         */
        const result = await RMService.createRM({
            memberName,
            email,
            password,
            mobile,
            role,
            createdBy: currentUser.userId,
        });



        return res.status(201).json({
            success: true,
            message: "RM created successfully",
            data: result,
        });

    } catch (err) {
        next(err);
    }
};

export const updateRM = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { rmId } = req.params;
        const {
            memberName,
            email,
            password,
            mobile,
            role,
            status,
            blockReason,
        } = req.body;

        const currentUser = (req as any).user;

        const updateData: any = {
            rmId,
            updatedBy: currentUser.userId,
        };

        if (memberName) updateData.memberName = memberName;
        if (email) updateData.email = email;
        if (password) updateData.password = password;
        if (mobile) updateData.mobile = mobile;
        if (role) updateData.role = role;
        if (status) updateData.status = status;
        if (blockReason) updateData.blockReason = blockReason;

        const result = await RMService.updateRM(updateData);

        return res.status(200).json({
            success: true,
            message: "RM updated successfully",
            data: result,
        });

    } catch (err) {
        next(err);
    }
};

/**
 * Get all RMs with pagination
 */
export const getAllRMs = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = req.user?.userId;

        // Get query parameters for pagination and filtering
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = req.query.search as string;
        const status = req.query.status as string;

        // Validate pagination params
        if (page < 1) {
            return res.status(400).json({
                success: false,
                message: "Page must be greater than 0",
            });
        }

        if (limit < 1 || limit > 100) {
            return res.status(400).json({
                success: false,
                message: "Limit must be between 1 and 100",
            });
        }

        // Get all RMs
        const result = await RMService.getAllRMs(userId as string, page, limit, search, status);

        return res.status(200).json({
            success: true,
            message: "RMs retrieved successfully",
            data: result.data,
            pagination: result.pagination,
        });

    } catch (err) {
        next(err);
    }
};

/**
 * Get RM by ID
 */
export const getRMById = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { rmId } = req.params;

        const rm = await RMService.getRMById(rmId as string);

        return res.status(200).json({
            success: true,
            message: "RM retrieved successfully",
            data: rm,
        });

    } catch (err) {
        next(err);
    }
};

/**
 * Get RM statistics (optional - for dashboard)
 */
export const getRMStats = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const stats = await RMService.getRMStats();

        return res.status(200).json({
            success: true,
            message: "RM statistics retrieved successfully",
            data: stats,
        });

    } catch (err) {
        next(err);
    }
};