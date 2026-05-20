import { Roles } from "../constants/roles";
import { RMService } from "../services/rm.service";
import { Request, Response, NextFunction } from "express";

export const createRM = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {

    try {
        console.log("RM Create body got: \n", req.body);

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

        const currentUser = (req as any).user;

        const result = await RMService.createRM({
            memberName,
            email,
            password,
            mobile,
            role,
            createdBy: currentUser.userId,
        });

        res.status(201).json({
            success: true,
            message: "RM created successfully",
            data: result,
        });

    } catch (err) {
        next(err);
    }
};