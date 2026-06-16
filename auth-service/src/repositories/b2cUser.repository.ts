import bcrypt from "bcryptjs";

import {
    UserModel,
    IUser,
    LoginType,
} from "../models/user.model";

import { Roles } from "../constants/roles";
import { UserStatus } from "../constants/userStatus";
import { ClientType } from "../constants/clientTypes";

export class B2CUserRepository {

    private static instance: B2CUserRepository;

    private constructor() { }

    public static getInstance(): B2CUserRepository {
        if (!B2CUserRepository.instance) {
            B2CUserRepository.instance = new B2CUserRepository();
        }

        return B2CUserRepository.instance;
    }


    /* =====================================================
       CREATE USER
    ===================================================== */

    async createUser(userData: {
        fullName: string;
        email: string;
        password?: string;
        mobileNumber: string;
        loginType: LoginType;
        role?: Roles;
        googleId?: string;
        googlePhoto?: string;
    }): Promise<IUser> {

        const user = new UserModel({

            clientType: ClientType.B2C,

            fullName: userData.fullName,

            email: userData.email.toLowerCase(),

            mobile: userData.mobileNumber,

            passwordHash: userData.password,

            loginType: userData.loginType,

            roles: userData.role || Roles.USER,

            status: UserStatus.ACTIVE,

            googleId: userData.googleId,

            googlePhoto: userData.googlePhoto,
        });

        return await user.save();
    }


    /* =====================================================
       FIND USER
    ===================================================== */

    async findByEmail(email: string): Promise<IUser | null> {

        return await UserModel.findOne({
            email: email.toLowerCase(),
            clientType: ClientType.B2C,
        });
    }

    async findByMobile(mobileNumber: string): Promise<IUser | null> {

        return await UserModel.findOne({
            mobile: mobileNumber,
            clientType: ClientType.B2C,
        });
    }

    async findById(userId: string): Promise<IUser | null> {

        return await UserModel.findById(userId);
    }

    async findByGoogleId(googleId: string): Promise<IUser | null> {

        return await UserModel.findOne({
            googleId,
            clientType: ClientType.B2C,
        });
    }


    /* =====================================================
       UPDATE USER
    ===================================================== */

    async updateUser(
        userId: string,
        updateData: Partial<IUser>
    ): Promise<IUser | null> {

        const mappedData: any = { ...updateData };

        if ((updateData as any).mobileNumber) {
            mappedData.mobile = (updateData as any).mobileNumber;
            delete mappedData.mobileNumber;
        }

        return await UserModel.findByIdAndUpdate(
            userId,
            { $set: mappedData },
            {
                new: true,
                runValidators: true,
            }
        );
    }


    /* =====================================================
       PASSWORD
    ===================================================== */

    async updatePassword(
        userId: string,
        newPassword: string
    ): Promise<boolean> {

        const result = await UserModel.findByIdAndUpdate(
            userId,
            {
                passwordHash: newPassword,
            },
            { new: true }
        );

        return result !== null;
    }

    async verifyPassword(
        user: IUser,
        password: string
    ): Promise<boolean> {

        if (!user.passwordHash) {
            return false;
        }

        return await bcrypt.compare(
            password,
            user.passwordHash
        );
    }

    async getUserWithPassword(
        email: string
    ): Promise<IUser | null> {

        return await UserModel.findOne({
            email: email.toLowerCase(),
            clientType: ClientType.B2C,
        });
    }


    /* =====================================================
       LOGIN
    ===================================================== */

    async updateLastLogin(
        userId: string,
        ipAddress?: string
    ): Promise<void> {

        await UserModel.findByIdAndUpdate(
            userId,
            {
                lastLogin: new Date(),
                lastLoginIP: ipAddress,
            }
        );
    }


    /* =====================================================
       EXISTS
    ===================================================== */

    async isEmailExists(email: string): Promise<boolean> {

        const user = await UserModel.findOne({
            email: email.toLowerCase(),
            clientType: ClientType.B2C,
        });

        return !!user;
    }

    async isMobileExists(
        mobileNumber: string
    ): Promise<boolean> {

        const user = await UserModel.findOne({
            mobile: mobileNumber,
            clientType: ClientType.B2C,
        });

        return !!user;
    }


    /* =====================================================
       DELETE
    ===================================================== */

    async softDeleteUser(
        userId: string
    ): Promise<IUser | null> {

        return await UserModel.findByIdAndUpdate(
            userId,
            {
                status: UserStatus.INACTIVE,
            },
            { new: true }
        );
    }

    async hardDeleteUser(
        userId: string
    ): Promise<boolean> {

        const result = await UserModel.findByIdAndDelete(
            userId
        );

        return result !== null;
    }


    /* =====================================================
       ADMIN
    ===================================================== */

    async getAllUsers(
        limit: number = 10,
        skip: number = 0
    ): Promise<IUser[]> {

        return await UserModel.find({
            clientType: ClientType.B2C,
        })
            .limit(limit)
            .skip(skip)
            .sort({ createdAt: -1 });
    }

    async getUsersByStatus(
        status: UserStatus
    ): Promise<IUser[]> {

        return await UserModel.find({
            status,
            clientType: ClientType.B2C,
        });
    }

    async updateUserStatus(
        userId: string,
        status: UserStatus
    ): Promise<IUser | null> {

        return await UserModel.findByIdAndUpdate(
            userId,
            { status },
            { new: true }
        );
    }

    /* =====================================================
   ADDITIONAL VALIDATION
===================================================== */

    async getUserWithDetails(email: string): Promise<IUser | null> {
        return await UserModel.findOne({
            email: email.toLowerCase(),
            clientType: ClientType.B2C,
        }).select('+passwordHash'); // Ensure password hash is included if needed
    }
}

export default B2CUserRepository;