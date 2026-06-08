import bcrypt from "bcryptjs";

import { Roles } from "../constants/roles";
import { ClientType } from "../constants/clientTypes";
import { UserStatus } from "../constants/userStatus";
import { VerificationStatus } from "../constants/verificationStatus";

import { UserModel } from "../models/user.model";

import { CreateRMInput, UpdateRMInput } from "../types/rm.types";

import {
    ConflictError,
    BadRequestError,
    NotFoundError,
} from "../errors/AppError";
import { EmailService } from "./email.service";
import { registrationSuccessEmailTemplate } from "../templates/registrationSuccessful.template";
import mongoose from "mongoose";

export class RMService {

    /**
     * Validate RM creation
     */
    public static async validateRMCreation(
        email: string,
        role: string
    ) {

        /**
         * Only RM role allowed
         */
        if (role !== Roles.RM) {
            throw new BadRequestError(
                "Only RM role can be created"
            );
        }

        /**
         * Check existing email
         */
        const existingUser = await UserModel.findOne({
            email: email.toLowerCase(),
        });

        if (existingUser) {
            throw new ConflictError(
                "User already exists"
            );
        }

        return true;
    }

    /**
     * Create RM
     */
    public static async createRM(
        data: CreateRMInput
    ) {

        const {
            memberName,
            email,
            password,
            mobile,
            role,
            createdBy,
        } = data;

        /**
         * Validate
         */
        await this.validateRMCreation(
            email,
            role
        );

        /**
         * Hash password
         */
        const passwordHash = await bcrypt.hash(
            password,
            10
        );

        /**
         * Create RM user
         */
        const user = new UserModel({
            clientType: ClientType.B2B,
            memberName: memberName,
            email: email.toLowerCase(),
            mobile,
            passwordHash,
            roles: Roles.RM,
            status: UserStatus.ACTIVE,
            verification: {
                status: VerificationStatus.APPROVED,
                verifiedAt: new Date(),
            },
            createdBy,
        });

        await user.save();

        /**
         * Send Email
         */
        await EmailService.sendEmail({
            to: email,
            subject: "Your OTP Verification Code",
            html: registrationSuccessEmailTemplate(email, password, role),
        });

        return {
            id: user._id,
            memberName,
            email: user.email,
            mobile: user.mobile,
            role: Roles.RM,
            createdBy: user.createdBy,
            createdAt: user.createdAt,
        };
    }

    /**
     * Update RM
     */
    public static async updateRM(
        data: UpdateRMInput
    ) {
        const {
            rmId,
            memberName,
            email,
            password,
            mobile,
            role,
            status,
            blockReason,
            updatedBy,
        } = data;

        const existingRM = await UserModel.findById(rmId);

        if (!existingRM) {
            throw new NotFoundError("RM not found");
        }

        if (existingRM.roles !== Roles.RM) {
            throw new BadRequestError("User is not an RM");
        }

        if (email && email.toLowerCase() !== existingRM.email) {
            const emailExists = await UserModel.findOne({
                email: email.toLowerCase(),
                _id: { $ne: rmId }
            });

            if (emailExists) {
                throw new ConflictError("Email already exists");
            }

            existingRM.email = email.toLowerCase();
        }

        if (memberName) {
            existingRM.memberName = memberName;
        }

        if (mobile) {
            existingRM.mobile = mobile;
        }

        if (role) {
            if (role !== Roles.RM) {
                throw new BadRequestError("Invalid role for RM");
            }
            existingRM.roles = Roles.RM;
        }

        if (password) {
            const passwordHash = await bcrypt.hash(password, 10);
            existingRM.passwordHash = passwordHash;
        }

        if (status) {
            const validStatuses = [UserStatus.ACTIVE, UserStatus.INACTIVE, UserStatus.BLOCKED];
            if (!validStatuses.includes(status as UserStatus)) {
                throw new BadRequestError("Invalid status. Allowed statuses: ACTIVE, INACTIVE, BLOCKED");
            }

            existingRM.status = status as UserStatus;

            if (status === UserStatus.BLOCKED) {
                if (!blockReason) {
                    throw new BadRequestError("Block reason is required when blocking an RM");
                }
                existingRM.blockReason = blockReason;
            } else if (status === UserStatus.ACTIVE || status === UserStatus.INACTIVE) {
                existingRM.blockReason = undefined;
            }
        }

        existingRM.updatedBy = updatedBy;
        existingRM.updatedAt = new Date();

        await existingRM.save();

        return {
            id: existingRM._id,
            memberName: existingRM.memberName,
            email: existingRM.email,
            mobile: existingRM.mobile,
            role: Roles.RM,
            status: existingRM.status,
            blockReason: existingRM.blockReason,
            updatedBy: existingRM.updatedBy,
            updatedAt: existingRM.updatedAt,
        };
    }

    /**
     * Get all RMs with pagination and filtering
     */
    public static async getAllRMs(
        userId: string,
        page: number = 1,
        limit: number = 10,
        search?: string,
        status?: string,
    ) {
        const skip = (page - 1) * limit;

        let query: any = {
            roles: Roles.RM,
            createdBy: userId,
        };

        if (status && status !== 'all') {
            query.status = status;
        }

        if (search) {
            query.$or = [
                { memberName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { mobile: { $regex: search, $options: 'i' } }
            ];
        }

        const total = await UserModel.countDocuments(query);

        const rms = await UserModel.find(query)
            .select('-passwordHash')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('createdBy', 'email memberName');

        return {
            data: rms,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1,
            }
        };
    }

    /**
     * Get RM by ID
     */
    public static async getRMById(rmId: string) {
        if (!mongoose.Types.ObjectId.isValid(rmId)) {
            throw new BadRequestError("Invalid RM ID format");
        }

        const rm = await UserModel.findOne({
            _id: rmId,
            roles: Roles.RM,
        })
            .select('-passwordHash')
            .populate('createdBy', 'email memberName');

        if (!rm) {
            throw new NotFoundError("RM not found");
        }

        return {
            id: rm._id,
            memberName: rm.memberName,
            email: rm.email,
            mobile: rm.mobile,
            role: rm.roles,
            status: rm.status,
            blockReason: rm.blockReason,
            createdBy: rm.createdBy,
            createdAt: rm.createdAt,
            updatedAt: rm.updatedAt,
        };
    }

    /**
     * Get RM statistics (optional)
     */
    public static async getRMStats() {
        const totalRMs = await UserModel.countDocuments({
            roles: Roles.RM,
        });

        const activeRMs = await UserModel.countDocuments({
            roles: Roles.RM,
            status: UserStatus.ACTIVE
        });

        const inactiveRMs = await UserModel.countDocuments({
            roles: Roles.RM,
            status: UserStatus.INACTIVE
        });

        return {
            total: totalRMs,
            active: activeRMs,
            inactive: inactiveRMs,
        };
    }
}