import { B2CUserRepository } from "../repositories/b2cUser.repository";
import { B2CLoginType, B2CRoles, B2CUserStatus } from "../models/b2cUser.model";
import bcrypt from "bcryptjs";
import { JWTUtil } from "../utils/JWT";
import { ClientType } from "../constants/clientTypes";
import { OTPType } from "../models/otp.model";
import { OTPService } from "./otp.service";

export class B2CAuthService {
    private static instance: B2CAuthService;
    private userRepository: B2CUserRepository;

    private constructor() {
        this.userRepository = B2CUserRepository.getInstance();
    }

    public static getInstance(): B2CAuthService {
        if (!B2CAuthService.instance) {
            B2CAuthService.instance = new B2CAuthService();
        }
        return B2CAuthService.instance;
    }

    /**
     * Register a new B2C user
     */
    async register(userData: {
        fullName: string;
        email: string;
        password: string;
        mobileNumber: string;
    }): Promise<{
        user: any;
        message: string;
    }> {
        // Check if email already exists
        const emailExists = await this.userRepository.isEmailExists(userData.email);
        if (emailExists) {
            throw new Error("Email already registered");
        }

        // Check if mobile already exists
        const mobileExists = await this.userRepository.isMobileExists(userData.mobileNumber);
        if (mobileExists) {
            throw new Error("Mobile number already registered");
        }

        // Validate password length
        if (userData.password.length < 6) {
            throw new Error("Password must be at least 6 characters");
        }



        // Create new user
        const user = await this.userRepository.createUser({
            fullName: userData.fullName,
            email: userData.email,
            password: userData.password,
            mobileNumber: userData.mobileNumber,
            loginType: B2CLoginType.EMAIL,
            role: B2CRoles.USER,
        });

        // Remove password from response
        const userResponse = user.toObject();
        delete (userResponse as any).password;

        return {
            user: userResponse,
            message: "User registered successfully",
        };
    }

    /**
     * Login B2C user with email and password
     */
    async loginWithEmail(credentials: {
        email: string;
        password: string;
        ipAddress?: string;
    }): Promise<{
        user: any;
        token: string;
        message: string;
    }> {
        // Find user by email
        const user = await this.userRepository.findByEmail(credentials.email);
        
        if (!user) {
            throw new Error("Invalid email or password");
        }

        // Check user status
        if (user.status !== B2CUserStatus.ACTIVE) {
            throw new Error(`Account is ${user.status.toLowerCase()}. Please contact support.`);
        }

        // Verify password
        const isPasswordValid = await this.userRepository.verifyPassword(user, credentials.password);
        
        if (!isPasswordValid) {
            throw new Error("Invalid email or password");
        }

        // Update last login
        await this.userRepository.updateLastLogin(user._id.toString(), credentials.ipAddress);

        // Generate JWT token
        const tokenPayload = {
            userId: user._id.toString(),
            email: user.email,
            clientType: ClientType.B2C,
            roles: [user.role],
        };
        
        const token = JWTUtil.getInstance().generateAccessToken(tokenPayload);

        // Remove password from response
        const userResponse = user.toObject();
        delete (userResponse as any).password;

        return {
            user: userResponse,
            token,
            message: "Login successful",
        };
    }

    /**
     * Get current user profile
     */
    async getCurrentUser(userId: string): Promise<any> {
        const user = await this.userRepository.findById(userId);
        
        if (!user) {
            throw new Error("User not found");
        }

        const userResponse = user.toObject();
        delete (userResponse as any).password;

        return userResponse;
    }

    /**
     * Update user profile
     */
    async updateProfile(userId: string, updateData: {
        fullName?: string;
        mobileNumber?: string;
    }): Promise<any> {
        // Check if mobile number is being changed and if it already exists
        if (updateData.mobileNumber) {
            const mobileExists = await this.userRepository.isMobileExists(updateData.mobileNumber);
            if (mobileExists) {
                const existingUser = await this.userRepository.findByMobile(updateData.mobileNumber);
                if (existingUser && existingUser._id.toString() !== userId) {
                    throw new Error("Mobile number already in use");
                }
            }
        }

        const updatedUser = await this.userRepository.updateUser(userId, updateData);
        
        if (!updatedUser) {
            throw new Error("User not found");
        }

        const userResponse = updatedUser.toObject();
        delete (userResponse as any).password;

        return userResponse;
    }

    /**
     * Change password
     */
    async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
        // Get user with password
        const user = await this.userRepository.findById(userId);
        
        if (!user) {
            throw new Error("User not found");
        }

        // Get full user with password field
        const userWithPassword = await B2CUserRepository.getInstance().getUserWithPassword(user.email);
        
        if (!userWithPassword) {
            throw new Error("User not found");
        }

        // Verify current password
        const isPasswordValid = await this.userRepository.verifyPassword(userWithPassword, currentPassword);
        
        if (!isPasswordValid) {
            throw new Error("Current password is incorrect");
        }

        // Validate new password
        if (newPassword.length < 6) {
            throw new Error("New password must be at least 6 characters");
        }

        // Hash and update new password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        await this.userRepository.updatePassword(userId, hashedPassword);
    }

    // Add these methods to B2CAuthService class

/**
 * Request OTP for signup verification
 */
async requestSignupOTP(email: string): Promise<{ otp: string; message: string }> {
    // Check if email already exists
    const emailExists = await this.userRepository.isEmailExists(email);
    if (emailExists) {
        throw new Error("Email already registered");
    }

    // Generate and send OTP
    const otpDoc = await OTPService.generateOTP(email, OTPType.SIGNUP);

    return {
        otp: otpDoc.otp, // Remove in production
        message: "OTP sent successfully",
    };
}

/**
 * Verify OTP and complete signup
 */
async verifySignupAndRegister(userData: {
    fullName: string;
    email: string;
    password: string;
    mobileNumber: string;
    otp: string;
}): Promise<{
    user: any;
    message: string;
}> {
    // Verify OTP first
    await OTPService.verifyOTP(
        userData.email.toLowerCase(),
        userData.otp,
        OTPType.SIGNUP
    );

    // Then register the user
    return this.register(userData);
}

/**
 * Request OTP for login 2FA
 */
async requestLoginOTP(email: string, password: string): Promise<{ otp: string; message: string }> {
    console.log("1. Request login OTP for:", email);
    // First verify credentials
    const user = await this.userRepository.findByEmail(email);

    console.log("2. User found:", user ? "Yes" : "No");
    
    if (!user) {
        throw new Error("Invalid email or password");
    }

    console.log("3. User status:", user.status);

    if (user.status !== B2CUserStatus.ACTIVE) {
        throw new Error(`Account is ${user.status.toLowerCase()}. Please contact support.`);
    }

    const isPasswordValid = await this.userRepository.verifyPassword(user, password);

    console.log("4. Password valid:", isPasswordValid);
    
    if (!isPasswordValid) {
        throw new Error("Invalid email or password");
    }

    console.log("5. Generating OTP...");

    // Generate and send OTP
    const otpDoc = await OTPService.generateOTP(email, OTPType.LOGIN);

    console.log("6. OTP generated:", otpDoc.otp);

    return {
        otp: otpDoc.otp, // Remove in production
        message: "OTP sent successfully",
    };
}

/**
 * Verify login OTP and complete login
 */
async verifyLoginAndAuthenticate(
    email: string,
    otp: string,
    ipAddress?: string
): Promise<{
    user: any;
    token: string;
    message: string;
}> {
    // Verify OTP
    await OTPService.verifyOTP(
        email.toLowerCase(),
        otp,
        OTPType.LOGIN
    );

    // Get user
    const user = await this.userRepository.findByEmail(email);
    
    if (!user) {
        throw new Error("User not found");
    }

    if (user.status !== B2CUserStatus.ACTIVE) {
        throw new Error(`Account is ${user.status.toLowerCase()}. Please contact support.`);
    }

    // Update last login
    await this.userRepository.updateLastLogin(user._id.toString(), ipAddress);

    // Generate JWT token
    const tokenPayload = {
        userId: user._id.toString(),
        email: user.email,
        clientType: ClientType.B2C,
        roles: [user.role],
    };
    
    const token = JWTUtil.getInstance().generateAccessToken(tokenPayload);

    // Remove password from response
    const userResponse = user.toObject();
    delete (userResponse as any).password;

    return {
        user: userResponse,
        token,
        message: "Login successful",
    };
}

}

export default B2CAuthService;