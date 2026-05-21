import { B2CUserModel, IB2CUser, B2CRoles, B2CLoginType, B2CUserStatus } from "../models/b2cUser.model";
import bcrypt from "bcryptjs";

export class B2CUserRepository {
    private static instance: B2CUserRepository;

    private constructor() {}

    public static getInstance(): B2CUserRepository {
        if (!B2CUserRepository.instance) {
            B2CUserRepository.instance = new B2CUserRepository();
        }
        return B2CUserRepository.instance;
    }

    /**
     * Create a new user (Registration)
     * Password will be hashed by the model pre-save middleware
     */
    async createUser(userData: {
        fullName: string;
        email: string;
        password: string;
        mobileNumber: string;
        loginType: B2CLoginType;
        role?: B2CRoles;
        googleId?: string;
        googlePhoto?: string;
    }): Promise<IB2CUser> {
        const user = new B2CUserModel({
            fullName: userData.fullName,
            email: userData.email.toLowerCase(),
            password: userData.password,
            mobileNumber: userData.mobileNumber,
            loginType: userData.loginType,
            role: userData.role || B2CRoles.USER,
            status: B2CUserStatus.ACTIVE,
            googleId: userData.googleId,
            googlePhoto: userData.googlePhoto,
        });

        const savedUser = await user.save();
        return savedUser;
    }

    /**
     * Find user by email
     */
    async findByEmail(email: string): Promise<IB2CUser | null> {
        return await B2CUserModel.findOne({ 
            email: email.toLowerCase() 
        }).select('+password');
    }

    /**
     * Find user by mobile number
     */
    async findByMobile(mobileNumber: string): Promise<IB2CUser | null> {
        return await B2CUserModel.findOne({ 
            mobileNumber 
        }).select('+password');
    }

    /**
     * Find user by ID
     */
    async findById(userId: string): Promise<IB2CUser | null> {
        return await B2CUserModel.findById(userId);
    }

    /**
     * Find user by Google ID
     */
    async findByGoogleId(googleId: string): Promise<IB2CUser | null> {
        return await B2CUserModel.findOne({ googleId });
    }

    /**
     * Update user details
     */
    async updateUser(userId: string, updateData: Partial<IB2CUser>): Promise<IB2CUser | null> {
        return await B2CUserModel.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
        );
    }

    /**
     * Update password
     */
    async updatePassword(userId: string, newPassword: string): Promise<boolean> {
        const result = await B2CUserModel.findByIdAndUpdate(
            userId,
            { password: newPassword },
            { new: true }
        );
        return result !== null;
    }

    /**
     * Update last login timestamp
     */
    async updateLastLogin(userId: string, ipAddress?: string): Promise<void> {
        await B2CUserModel.findByIdAndUpdate(userId, {
            lastLogin: new Date(),
            lastLoginIP: ipAddress,
        });
    }

    /**
     * Check if email already exists
     */
    async isEmailExists(email: string): Promise<boolean> {
        const user = await B2CUserModel.findOne({ 
            email: email.toLowerCase() 
        });
        return user !== null;
    }

    /**
     * Check if mobile number already exists
     */
    async isMobileExists(mobileNumber: string): Promise<boolean> {
        const user = await B2CUserModel.findOne({ 
            mobileNumber 
        });
        return user !== null;
    }

    /**
     * Get user by email with password (for login)
     */
    async getUserWithPassword(email: string): Promise<IB2CUser | null> {
        return await B2CUserModel.findOne({ 
            email: email.toLowerCase() 
        }).select('+password');
    }

    /**
     * Verify user password
     */
    async verifyPassword(user: IB2CUser, password: string): Promise<boolean> {
        return await bcrypt.compare(password, user.password);
    }

    /**
     * Delete user (soft delete - change status)
     */
    async softDeleteUser(userId: string): Promise<IB2CUser | null> {
        return await B2CUserModel.findByIdAndUpdate(
            userId,
            { status: B2CUserStatus.INACTIVE },
            { new: true }
        );
    }

    /**
     * Permanently delete user
     */
    async hardDeleteUser(userId: string): Promise<boolean> {
        const result = await B2CUserModel.findByIdAndDelete(userId);
        return result !== null;
    }

    /**
     * Get all users (with pagination)
     */
    async getAllUsers(limit: number = 10, skip: number = 0): Promise<IB2CUser[]> {
        return await B2CUserModel.find()
            .limit(limit)
            .skip(skip)
            .sort({ createdAt: -1 });
    }

    /**
     * Get users by status
     */
    async getUsersByStatus(status: B2CUserStatus): Promise<IB2CUser[]> {
        return await B2CUserModel.find({ status });
    }

    /**
     * Update user status
     */
    async updateUserStatus(userId: string, status: B2CUserStatus): Promise<IB2CUser | null> {
        return await B2CUserModel.findByIdAndUpdate(
            userId,
            { status },
            { new: true }
        );
    }
}

export default B2CUserRepository;