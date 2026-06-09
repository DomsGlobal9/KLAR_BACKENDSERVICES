import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { UserModel } from "../models/user.model";
import { Wallet } from "../models/wallet.model";
import { ClientType } from "../constants/clientTypes";
import { UserStatus } from "../constants/userStatus";
import { VerificationStatus } from "../constants/verificationStatus";
import { WalletStatus } from "../constants/walletStatus";
import { Roles } from "../constants/roles";
import {
    ConflictError,
    BadRequestError,
    NotFoundError,
    UnauthorizedError,
} from "../errors/AppError";
import { EmailService } from "./email.service";
import { registrationSuccessEmailTemplate } from "../templates/registrationSuccessful.template";

export interface CreateSubCompanyInput {
    businessName: string;
    businessType: string;
    contactPerson: string;
    businessEmail: string;
    businessMobile: string;
    password: string;
    gstNumber?: string;
    panNumber?: string;
    address: string;
    city: string;
    country: string;
    createdBy: string; // Parent B2B_ADMIN ID
}

export interface UpdateSubCompanyInput {
    businessName?: string;
    businessType?: string;
    contactPerson?: string;
    businessEmail?: string;
    businessMobile?: string;
    password?: string;
    gstNumber?: string;
    panNumber?: string;
    address?: string;
    city?: string;
    country?: string;
    status?: UserStatus;
    blockReason?: string;
}

export class CompanyService {

    /**
     * Validate company creation
     */
    public static async validateCompanyCreation(email: string) {
        const existingUser = await UserModel.findOne({
            email: email.toLowerCase(),
        });

        if (existingUser) {
            throw new ConflictError("Company with this email already exists");
        }

        return true;
    }

    /**
     * Create sub-company under a parent B2B_ADMIN
     */
    public static async createSubCompany(data: CreateSubCompanyInput) {
        const {
            businessName,
            businessType,
            contactPerson,
            businessEmail,
            businessMobile,
            password,
            gstNumber,
            panNumber,
            address,
            city,
            country,
            createdBy,
        } = data;

        // Verify parent admin exists
        const parentAdmin = await UserModel.findById(createdBy);
        if (!parentAdmin) {
            throw new NotFoundError("Parent admin not found");
        }

        if (parentAdmin.roles !== Roles.B2B_ADMIN) {
            throw new UnauthorizedError("Only B2B_ADMIN can create sub-companies");
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create sub-company user
        const user = new UserModel({
            clientType: ClientType.B2B,
            email: businessEmail.toLowerCase(),
            mobile: businessMobile,
            passwordHash,
            roles: Roles.B2B_ADMIN, // Same role as parent
            status: UserStatus.ACTIVE, // ACTIVE by default
            businessProfile: {
                businessName,
                businessType,
                contactPerson,
                businessEmail: businessEmail.toLowerCase(),
                businessMobile,
                gstNumber,
                panNumber,
                address,
                city,
                country,
            },
            verification: {
                status: VerificationStatus.APPROVED, // AUTO-VERIFIED
                verifiedAt: new Date(),
            },
            createdBy: new mongoose.Types.ObjectId(createdBy), // Track parent
        });

        await user.save();

        // Create wallet for sub-company
        const wallet = new Wallet({
            userId: user._id,
            balance: 0,
            currency: "INR",
            status: WalletStatus.ACTIVE,
            emailAlerts: true,
            smsAlerts: false,
        });

        await wallet.save();

        // Send email notification
        await EmailService.sendEmail({
            to: businessEmail,
            subject: "Welcome! Your Sub-Company Account has been Created",
            html: registrationSuccessEmailTemplate(
                businessEmail,
                password,
                "B2B_ADMIN"
            ),
        });

        return {
            id: user._id,
            businessName,
            businessEmail: user.email,
            businessMobile: user.mobile,
            role: user.roles,
            status: user.status,
            createdBy: user.createdBy,
            createdAt: user.createdAt,
            wallet: {
                id: wallet._id,
                balance: wallet.balance,
                currency: wallet.currency,
                status: wallet.status,
            },
        };
    }

    /**
     * Get all sub-companies created by a specific B2B_ADMIN
     */
    public static async getAllSubCompanies(
        parentAdminId: string,
        page: number = 1,
        limit: number = 10,
        search?: string,
        status?: string
    ) {
        const skip = (page - 1) * limit;

        // Verify parent admin exists
        const parentAdmin = await UserModel.findById(parentAdminId);
        if (!parentAdmin) {
            throw new NotFoundError("Parent admin not found");
        }

        let query: any = {
            roles: Roles.B2B_ADMIN,
            createdBy: new mongoose.Types.ObjectId(parentAdminId),
        };

        if (status && status !== 'all') {
            query.status = status;
        }

        if (search) {
            query.$or = [
                { "businessProfile.businessName": { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { mobile: { $regex: search, $options: 'i' } }
            ];
        }

        const total = await UserModel.countDocuments(query);

        const companies = await UserModel.find(query)
            .select('-passwordHash')
            .populate('createdBy', 'email memberName businessProfile.businessName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Get wallets for each company
        const companiesWithWallets = await Promise.all(
            companies.map(async (company) => {
                const wallet = await Wallet.findOne({ userId: company._id });
                return {
                    id: company._id,
                    email: company.email,
                    mobile: company.mobile,
                    role: company.roles,
                    status: company.status,
                    businessProfile: company.businessProfile,
                    createdBy: company.createdBy,
                    createdAt: company.createdAt,
                    updatedAt: company.updatedAt,
                    wallet: wallet ? {
                        balance: wallet.balance,
                        currency: wallet.currency,
                        status: wallet.status,
                    } : null,
                };
            })
        );

        return {
            data: companiesWithWallets,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1,
            },
        };
    }

    /**
     * Get sub-company by ID (with ownership validation)
     */
    public static async getSubCompanyById(companyId: string, parentAdminId: string) {
        if (!mongoose.Types.ObjectId.isValid(companyId)) {
            throw new BadRequestError("Invalid company ID format");
        }

        const company = await UserModel.findOne({
            _id: companyId,
            roles: Roles.B2B_ADMIN,
            createdBy: new mongoose.Types.ObjectId(parentAdminId),
        }).select('-passwordHash');

        if (!company) {
            throw new NotFoundError("Sub-company not found or access denied");
        }

        const wallet = await Wallet.findOne({ userId: company._id });

        return {
            id: company._id,
            email: company.email,
            mobile: company.mobile,
            role: company.roles,
            status: company.status,
            blockReason: company.blockReason,
            businessProfile: company.businessProfile,
            verification: company.verification,
            createdBy: company.createdBy,
            createdAt: company.createdAt,
            updatedAt: company.updatedAt,
            wallet: wallet ? {
                id: wallet._id,
                balance: wallet.balance,
                currency: wallet.currency,
                status: wallet.status,
                emailAlerts: wallet.emailAlerts,
                smsAlerts: wallet.smsAlerts,
            } : null,
        };
    }

    /**
     * Update sub-company
     */
    public static async updateSubCompany(
        companyId: string,
        parentAdminId: string,
        updateData: UpdateSubCompanyInput
    ) {
        if (!mongoose.Types.ObjectId.isValid(companyId)) {
            throw new BadRequestError("Invalid company ID format");
        }

        const company = await UserModel.findOne({
            _id: companyId,
            roles: Roles.B2B_ADMIN,
            createdBy: new mongoose.Types.ObjectId(parentAdminId),
        });

        if (!company) {
            throw new NotFoundError("Sub-company not found or access denied");
        }

        // Update basic fields
        if (updateData.businessMobile) {
            company.mobile = updateData.businessMobile;
        }

        if (updateData.status) {
            const validStatuses = [UserStatus.ACTIVE, UserStatus.INACTIVE, UserStatus.BLOCKED];
            if (!validStatuses.includes(updateData.status)) {
                throw new BadRequestError("Invalid status");
            }
            company.status = updateData.status;

            if (updateData.status === UserStatus.BLOCKED && !updateData.blockReason) {
                throw new BadRequestError("Block reason is required when blocking");
            }
            if (updateData.status === UserStatus.BLOCKED) {
                company.blockReason = updateData.blockReason;
            } else {
                company.blockReason = undefined;
            }
        }

        if (company.businessProfile) {
            if (updateData.businessName) company.businessProfile.businessName = updateData.businessName;
            if (updateData.businessType) company.businessProfile.businessType = updateData.businessType;
            if (updateData.contactPerson) company.businessProfile.contactPerson = updateData.contactPerson;
            if (updateData.businessEmail) company.businessProfile.businessEmail = updateData.businessEmail;
            if (updateData.businessMobile) company.businessProfile.businessMobile = updateData.businessMobile;
            if (updateData.gstNumber) company.businessProfile.gstNumber = updateData.gstNumber;
            if (updateData.panNumber) company.businessProfile.panNumber = updateData.panNumber;
            if (updateData.address) company.businessProfile.address = updateData.address;
            if (updateData.city) company.businessProfile.city = updateData.city;
            if (updateData.country) company.businessProfile.country = updateData.country;
        }

        // Update email if changed
        if (updateData.businessEmail && updateData.businessEmail !== company.email) {
            const emailExists = await UserModel.findOne({
                email: updateData.businessEmail.toLowerCase(),
                _id: { $ne: companyId }
            });
            if (emailExists) {
                throw new ConflictError("Email already exists");
            }
            company.email = updateData.businessEmail.toLowerCase();
        }

        // Update password if provided
        if (updateData.password) {
            company.passwordHash = await bcrypt.hash(updateData.password, 10);
        }

        company.updatedAt = new Date();
        await company.save();

        // Get wallet
        const wallet = await Wallet.findOne({ userId: company._id });

        return {
            id: company._id,
            email: company.email,
            mobile: company.mobile,
            role: company.roles,
            status: company.status,
            businessProfile: company.businessProfile,
            updatedAt: company.updatedAt,
            wallet: wallet ? {
                balance: wallet.balance,
                currency: wallet.currency,
                status: wallet.status,
            } : null,
        };
    }
}