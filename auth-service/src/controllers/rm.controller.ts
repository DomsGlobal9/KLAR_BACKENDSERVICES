import { Request, Response, NextFunction } from "express";

import { Roles } from "../constants/roles";

import { RMService } from "../services/rm.service";
import { OTPService } from "../services/otp.service";

import { OTPType } from "../models/otp.model";

export const createRM = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {

    try {

        console.log("RM Create body got:\n", req.body);

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