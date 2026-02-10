import bcrypt from "bcryptjs";
import { UserModel } from "../models/user.model";
import { Wallet } from "../models/wallet.model";
import { ClientType } from "../constants/clientTypes";
import { UserStatus } from "../constants/userStatus";
import { VerificationStatus } from "../constants/verificationStatus";
import { WalletStatus } from "../constants/walletStatus";
import { Roles } from "../constants/roles";
import { JWTUtil, TokenPayload } from "../utils/JWT";
import { ConflictError, UnauthorizedError } from "../errors/AppError";

export interface B2BSignupInput {
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
}

export interface LoginInput {
    email: string;
    password: string;
    clientType: ClientType;
}

export interface AuthResponse {
    user: {
        id: string;
        email: string;
        token?: string;
        roles: string[];
        clientType: ClientType;
        status: UserStatus;
        verificationStatus: VerificationStatus;
        blockReason?: string;
        pendingReason?: string;
        rejectedReason?: string;
    };
    token?: string;
}

export interface SignupResponse {
    status: UserStatus;
}

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

export class AuthService {
    private passwordUtil: PasswordUtil;
    private jwtUtil: JWTUtil;
    private static instance: AuthService;

    private constructor() {
        this.passwordUtil = PasswordUtil.getInstance();
        this.jwtUtil = JWTUtil.getInstance();
    }

    public static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    public async signupB2B(data: B2BSignupInput): Promise<SignupResponse> {
        const {
            businessName,
            businessType,
            contactPerson,
            businessEmail,
            businessMobile,
            password,
        } = data;

        /**
         * Check existing user
         */
        const existingUser = await UserModel.findOne({
            email: businessEmail.toLowerCase(),
            clientType: ClientType.B2B,
        });

        if (existingUser) {
            throw new ConflictError('User already exists');
        }

        /**
         * Hash password
         */
        const passwordHash = await this.passwordUtil.hashPassword(password);

        /**
         * Create user
         */
        const user = new UserModel({
            clientType: ClientType.B2B,
            email: businessEmail.toLowerCase(),
            mobile: businessMobile,
            passwordHash,

            roles: [Roles.B2B_ADMIN],
            status: UserStatus.VERIFICATION_PENDING,

            businessProfile: {
                businessName,
                businessType,
                contactPerson,
                businessEmail,
                businessMobile,
                gstNumber: data.gstNumber,
                panNumber: data.panNumber,
                address: data.address,
                city: data.city,
                country: data.country,
            },

            verification: {
                status: VerificationStatus.PENDING,
            },

            wallet: {
                status: WalletStatus.INACTIVE || "inactive",
            },
        });

        /**
         * Save user
         */
        await user.save();

        // Now create wallet separately
        const wallet = new Wallet({
            userId: user._id, // Now we have the user ID
            balance: 0,
            currency: "INR",
            status: "ACTIVE", // Use uppercase as per your enum
            emailAlerts: true,
            smsAlerts: false,
        });

        await wallet.save();

        return {
            status: user.status,
        };
    }

    public async login(data: LoginInput): Promise<AuthResponse> {
        const { email, password, clientType } = data;

        /**
         * Find user by email and client type
         */
        const user = await UserModel.findOne({
            email: email.toLowerCase(),
            clientType,
        });

        if (!user) {
            throw new UnauthorizedError('Invalid credentials');
        }

        /**
         * Validate password
         */
        const isMatch = await this.passwordUtil.comparePassword(password, user.passwordHash);
        if (!isMatch) {
            throw new UnauthorizedError('Invalid credentials');
        }

        /**
         * Return user info for non-ACTIVE statuses without throwing error
         */
        if (user.status !== UserStatus.ACTIVE) {
            return {
                user: {
                    id: user._id.toString(),
                    email: user.email,
                    roles: user.roles,
                    clientType: user.clientType,
                    status: user.status,
                    verificationStatus: user.verification.status,
                    blockReason: user.blockReason,
                    pendingReason: user.pendingReason,
                    rejectedReason: user.rejectedReason,
                },
            };
        }

        /**
         * Generate JWT token for ACTIVE users
         */
        const tokenPayload: TokenPayload = {
            userId: user._id.toString(),
            email: user.email,
            clientType: user.clientType,
            roles: user.roles,
        };

        const token = this.jwtUtil.generateAccessToken(tokenPayload);

        return {
            token,
            user: {
                id: user._id.toString(),
                email: user.email,
                token: token,
                roles: user.roles,
                clientType: user.clientType,
                status: user.status,
                verificationStatus: user.verification.status,
            },
        };
    }

    // Optional: Add refresh token functionality
    public async refreshToken(refreshToken: string): Promise<AuthResponse> {
        if (!refreshToken) {
            throw new UnauthorizedError('Refresh token is required');
        }

        const decoded = this.jwtUtil.verifyRefreshToken(refreshToken);

        const user = await UserModel.findById(decoded.userId);
        if (!user) {
            throw new UnauthorizedError('Invalid refresh token');
        }

        const tokenPayload: TokenPayload = {
            userId: user._id.toString(),
            email: user.email,
            clientType: user.clientType,
            roles: user.roles,
        };

        const newAccessToken = this.jwtUtil.generateAccessToken(tokenPayload);
        const newRefreshToken = this.jwtUtil.generateRefreshToken(tokenPayload);

        return {
            token: newAccessToken,
            user: {
                id: user._id.toString(),
                email: user.email,
                token: newAccessToken,
                roles: user.roles,
                clientType: user.clientType,
                status: user.status,
                verificationStatus: user.verification.status,

            },
        };
    }

    public async getCurrentUser(userId: string): Promise<any> {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new UnauthorizedError('User not found');
        }

        return {
            id: user._id.toString(),
            email: user.email,
            roles: user.roles,
            clientType: user.clientType,
            status: user.status,
            verificationStatus: user.verification?.status,
        };
    }
}