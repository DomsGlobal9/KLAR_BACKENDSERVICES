import { B2CUserRepository } from "../repositories/b2cUser.repository";
import { B2CLoginType, B2CRoles, B2CUserStatus } from "../models/b2cUser.model";
import bcrypt from "bcryptjs";
import { JWTUtil } from "../utils/JWT";
import { ClientType } from "../constants/clientTypes";
import { OTPType } from "../models/otp.model";
import { OTPService } from "./otp.service";

class PasswordUtil {
    private static instance: PasswordUtil;

    private constructor() { }

    public static getInstance(): PasswordUtil {
        if (!PasswordUtil.instance) {
            PasswordUtil.instance = new PasswordUtil();
        }
        return PasswordUtil.instance;
    }

    public async hashPassword(password: string): Promise<string> {
        return await bcrypt.hash(password, 10);
    }

    public async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
        return await bcrypt.compare(password, hashedPassword);
    }
}

export class B2CAuthService {
    private passwordUtil: PasswordUtil;
    private static instance: B2CAuthService;
    private userRepository: B2CUserRepository;

    private constructor() {
        this.userRepository = B2CUserRepository.getInstance();
        this.passwordUtil = PasswordUtil.getInstance();
    }

    public static getInstance(): B2CAuthService {
        if (!B2CAuthService.instance) {
            B2CAuthService.instance = new B2CAuthService();
        }
        return B2CAuthService.instance;
    }

    async register(userData: {
        fullName: string;
        email: string;
        password: string;
        mobileNumber: string;
    }): Promise<{
        user: any;
        message: string;
    }> {
        const emailExists = await this.userRepository.isEmailExists(userData.email);
        if (emailExists) {
            throw new Error("Email already registered");
        }

        const mobileExists = await this.userRepository.isMobileExists(userData.mobileNumber);
        if (mobileExists) {
            throw new Error("Mobile number already registered");
        }

        if (userData.password.length < 6) {
            throw new Error("Password must be at least 6 characters");
        }

        const passwordHash = await this.passwordUtil.hashPassword(userData.password);
        console.log("THe password hash we got", passwordHash);

        const user = await this.userRepository.createUser({
            fullName: userData.fullName,
            email: userData.email,
            password: passwordHash,
            mobileNumber: userData.mobileNumber,
            loginType: B2CLoginType.EMAIL,
            role: B2CRoles.USER,
        });

        const userResponse = user.toObject();
        delete (userResponse as any).password;

        return {
            user: userResponse,
            message: "User registered successfully",
        };
    }

    async loginWithEmail(credentials: {
        email: string;
        password: string;
        ipAddress?: string;
    }): Promise<{
        user: any;
        token: string;
        message: string;
    }> {
        const user = await this.userRepository.findByEmail(credentials.email);

        if (!user) {
            throw new Error("Invalid email or password");
        }

        if (user.status !== B2CUserStatus.ACTIVE) {
            throw new Error(`Account is ${user.status.toLowerCase()}. Please contact support.`);
        }

        const isPasswordValid = await this.passwordUtil.comparePassword(credentials.password, user.password);

        if (!isPasswordValid) {
            throw new Error("Invalid email or password");
        }

        await this.userRepository.updateLastLogin(user._id.toString(), credentials.ipAddress);

        const tokenPayload = {
            userId: user._id.toString(),
            email: user.email,
            clientType: ClientType.B2C,
            roles: [user.role],
        };

        const token = JWTUtil.getInstance().generateAccessToken(tokenPayload);

        const userResponse = user.toObject();
        delete (userResponse as any).password;

        return {
            user: userResponse,
            token,
            message: "Login successful",
        };
    }

    async getCurrentUser(userId: string): Promise<any> {
        const user = await this.userRepository.findById(userId);

        if (!user) {
            throw new Error("User not found");
        }

        const userResponse = user.toObject();
        delete (userResponse as any).password;

        return userResponse;
    }

    async updateProfile(userId: string, updateData: {
        fullName?: string;
        mobileNumber?: string;
    }): Promise<any> {
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

    async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
        const user = await this.userRepository.findById(userId);

        if (!user) {
            throw new Error("User not found");
        }

        const userWithPassword = await B2CUserRepository.getInstance().getUserWithPassword(user.email);

        if (!userWithPassword) {
            throw new Error("User not found");
        }

        const isPasswordValid = await this.passwordUtil.comparePassword(currentPassword, userWithPassword.password);

        if (!isPasswordValid) {
            throw new Error("Current password is incorrect");
        }

        if (newPassword.length < 6) {
            throw new Error("New password must be at least 6 characters");
        }

        const hashedPassword = await this.passwordUtil.hashPassword(newPassword);

        await this.userRepository.updatePassword(userId, hashedPassword);
    }

    async requestSignupOTP(email: string): Promise<{ otp: string; message: string }> {
        const emailExists = await this.userRepository.isEmailExists(email);
        if (emailExists) {
            throw new Error("Email already registered");
        }

        const otpDoc = await OTPService.generateOTP(email, OTPType.SIGNUP);

        return {
            otp: otpDoc.otp,
            message: "OTP sent successfully",
        };
    }

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
        await OTPService.verifyOTP(
            userData.email.toLowerCase(),
            userData.otp,
            OTPType.SIGNUP
        );

        return this.register(userData);
    }

    async requestLoginOTP(email: string, password: string): Promise<{ otp: string; message: string }> {
        console.log("1. Request login OTP for:", email);

        const user = await this.userRepository.findByEmail(email);
        console.log("2. User found:", user ? "Yes" : "No");

        if (!user) {
            throw new Error("Invalid email or password");
        }

        console.log("3. User status:", user.status);

        if (user.status !== B2CUserStatus.ACTIVE) {
            throw new Error(`Account is ${user.status.toLowerCase()}. Please contact support.`);
        }

        const isPasswordValid = await this.passwordUtil.comparePassword(password, user.password);
        console.log("4. Password valid:", isPasswordValid);

        if (!isPasswordValid) {
            throw new Error("Invalid email or password");
        }

        console.log("5. Generating OTP...");

        const otpDoc = await OTPService.generateOTP(email, OTPType.LOGIN);
        console.log("6. OTP generated:", otpDoc.otp);

        return {
            otp: otpDoc.otp,
            message: "OTP sent successfully",
        };
    }

    async verifyLoginAndAuthenticate(
        email: string,
        otp: string,
        ipAddress?: string
    ): Promise<{
        user: any;
        token: string;
        message: string;
    }> {
        await OTPService.verifyOTP(
            email.toLowerCase(),
            otp,
            OTPType.LOGIN
        );

        const user = await this.userRepository.findByEmail(email);

        if (!user) {
            throw new Error("User not found");
        }

        if (user.status !== B2CUserStatus.ACTIVE) {
            throw new Error(`Account is ${user.status.toLowerCase()}. Please contact support.`);
        }

        await this.userRepository.updateLastLogin(user._id.toString(), ipAddress);

        const tokenPayload = {
            userId: user._id.toString(),
            email: user.email,
            clientType: ClientType.B2C,
            roles: [user.role],
        };

        const token = JWTUtil.getInstance().generateAccessToken(tokenPayload);

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