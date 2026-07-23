import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { UserModel } from "../models/user.model";
import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
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
    gstRegisteredName?: string;
    gstEmail?: string;
    gstMobile?: string;
    gstAddress?: string;
    panNumber?: string;
    address: string;
    city: string;
    country: string;
    limit?: number;
    createdBy: string;
}

export interface UpdateSubCompanyInput {
    businessName?: string;
    businessType?: string;
    contactPerson?: string;
    businessEmail?: string;
    businessMobile?: string;
    password?: string;
    gstNumber?: string;
    gstRegisteredName?: string;
    gstEmail?: string;
    gstMobile?: string;
    gstAddress?: string;
    panNumber?: string;
    address?: string;
    city?: string;
    country?: string;
    limit?: number;
    status?: UserStatus;
    blockReason?: string;
    settlementAmount?: number;
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
            gstRegisteredName,
            gstEmail,
            gstMobile,
            gstAddress,
            panNumber,
            address,
            city,
            country,
            limit,
            createdBy,
        } = data;


        const parentAdmin = await UserModel.findById(createdBy);
        if (!parentAdmin) {
            throw new NotFoundError("Parent admin not found");
        }

        if (parentAdmin.roles !== Roles.B2B_ADMIN) {
            throw new UnauthorizedError("Only B2B_ADMIN can create sub-companies");
        }


        const passwordHash = await bcrypt.hash(password, 10);


        const user = new UserModel({
            clientType: ClientType.B2B,
            email: businessEmail.toLowerCase(),
            mobile: businessMobile,
            passwordHash,
            roles: Roles.B2B_ADMIN,
            status: UserStatus.ACTIVE,
            limit,
            businessProfile: {
                businessName,
                businessType,
                contactPerson,
                businessEmail: businessEmail.toLowerCase(),
                businessMobile,
                gstNumber,
                gstRegisteredName,
                gstEmail: gstEmail?.toLowerCase(),
                gstMobile,
                gstAddress,
                panNumber,
                address,
                city,
                country,
            },
            verification: {
                status: VerificationStatus.APPROVED,
                verifiedAt: new Date(),
            },
            createdBy: new mongoose.Types.ObjectId(createdBy),
        });

        await user.save();


        const wallet = new Wallet({
            userId: user._id,
            balance: 0,
            currency: "INR",
            limit: limit,
            status: WalletStatus.ACTIVE,
            emailAlerts: true,
            smsAlerts: false,
        });

        await wallet.save();

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


        const companiesWithWallets = await Promise.all(
            companies.map(async (company) => {
                const wallet = await Wallet.findOne({ userId: company._id });
                return {
                    id: company._id,
                    email: company.email,
                    mobile: company.mobile,
                    role: company.roles,
                    status: company.status,
                    limit: company.limit,
                    businessProfile: company.businessProfile,
                    createdBy: company.createdBy,
                    createdAt: company.createdAt,
                    updatedAt: company.updatedAt,
                    wallet: wallet ? {
                        balance: wallet.balance,
                        currency: wallet.currency,
                        status: wallet.status,
                        limit: wallet.limit,
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
            limit: company.limit,
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
                limit: wallet.limit,
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

        if (updateData.settlementAmount !== undefined && updateData.settlementAmount > 0) {
            const settlementAmount = updateData.settlementAmount;


            const parentWallet = await Wallet.findOne({ userId: new mongoose.Types.ObjectId(parentAdminId) });
            if (!parentWallet) {
                throw new NotFoundError("Parent wallet not found");
            }


            const subCompanyWallet = await Wallet.findOne({ userId: company._id });
            if (!subCompanyWallet) {
                throw new NotFoundError("Sub-company wallet not found");
            }


            const currentSubCompanyBalance = subCompanyWallet.balance || 0;
            const debtAmount = currentSubCompanyBalance < 0 ? Math.abs(currentSubCompanyBalance) : 0;
            const parentKeepAmount = Math.min(settlementAmount, debtAmount);
            const subCompanyCreditAmount = settlementAmount - parentKeepAmount;

            const newSubCompanyBalance = currentSubCompanyBalance + settlementAmount;
            subCompanyWallet.balance = newSubCompanyBalance;
            await subCompanyWallet.save();

            const newParentBalance = (parentWallet.balance || 0) + parentKeepAmount;
            parentWallet.balance = newParentBalance;
            await parentWallet.save();

            if (parentKeepAmount > 0) {
                await WalletTransaction.create({
                    walletId: parentWallet._id,
                    userId: new mongoose.Types.ObjectId(parentAdminId),
                    type: "CREDIT",
                    direction: "CREDIT",
                    amount: parentKeepAmount,
                    paymentMethod: "CASH_SETTLEMENT",
                    referenceType: "SETTLEMENT",
                    referenceId: companyId,
                    description: `Settlement received from sub-company ${company.businessProfile?.businessName || company.email} for debt clearance`,
                    status: "SUCCESS",
                });
            }

            if (settlementAmount > 0) {
                await WalletTransaction.create({
                    walletId: subCompanyWallet._id,
                    userId: company._id,
                    type: "CREDIT",
                    direction: "CREDIT",
                    amount: settlementAmount,
                    paymentMethod: "CASH_SETTLEMENT",
                    referenceType: "SETTLEMENT",
                    referenceId: companyId,
                    description: `Cash settlement of ₹${settlementAmount} added to wallet`,
                    status: "SUCCESS",
                });
            }

            delete updateData.settlementAmount;
        }

        if (updateData.businessMobile) {
            company.mobile = updateData.businessMobile;
        }

        if (updateData.limit !== undefined) {
            company.limit = updateData.limit;
        }

        if (updateData.limit !== undefined) {
            const wallet = await Wallet.findOne({ userId: company._id });
            if (wallet) {
                wallet.limit = updateData.limit;
                await wallet.save();
            }
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
            if (updateData.gstRegisteredName) company.businessProfile.gstRegisteredName = updateData.gstRegisteredName;
            if (updateData.gstEmail) company.businessProfile.gstEmail = updateData.gstEmail.toLowerCase();
            if (updateData.gstMobile) company.businessProfile.gstMobile = updateData.gstMobile;
            if (updateData.gstAddress) company.businessProfile.gstAddress = updateData.gstAddress;
            if (updateData.panNumber) company.businessProfile.panNumber = updateData.panNumber;
            if (updateData.address) company.businessProfile.address = updateData.address;
            if (updateData.city) company.businessProfile.city = updateData.city;
            if (updateData.country) company.businessProfile.country = updateData.country;
        }

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

        if (updateData.password) {
            company.passwordHash = await bcrypt.hash(updateData.password, 10);
        }

        company.updatedAt = new Date();
        await company.save();

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
                limit: wallet.limit,
            } : null,
        };
    }
}