import bcrypt from "bcryptjs";

import { Roles } from "../constants/roles";
import { ClientType } from "../constants/clientTypes";
import { UserStatus } from "../constants/userStatus";
import { VerificationStatus } from "../constants/verificationStatus";

import { UserModel } from "../models/user.model";

import { CreateRMInput } from "../types/rm.types";

import {
    ConflictError,
    BadRequestError,
} from "../errors/AppError";
import { EmailService } from "./email.service";
import { registrationSuccessEmailTemplate } from "../templates/registrationSuccessful.template";

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

            email: email.toLowerCase(),

            mobile,

            passwordHash,

            roles: [Roles.RM],

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
}