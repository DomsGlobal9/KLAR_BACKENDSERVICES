import User, { IUser, UserRole } from '../db/models/User.model';
import RefreshToken from '../db/models/RefreshToken.model';
const jwt = require('jsonwebtoken');

export interface JwtPayload {
    userId: string;
    email: string;
    role: UserRole;
}

export interface AuthUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
}

export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
}

export interface RegisterData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: UserRole;
}

class AuthService {
    private accessTokenSecret: string;
    private refreshTokenSecret: string;
    private accessTokenExpiry: string = '15m';
    private refreshTokenExpiry: string = '7d';

    constructor() {
        this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'your-access-secret-key-change-this';
        this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-this';

        if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
            console.warn('⚠️  JWT secrets not set in environment variables. Using default (INSECURE)');
        }
    }

    /**
     * Register a new user
     */
    public async register(data: RegisterData): Promise<AuthUser> {
        // Check if user already exists
        const existingUser = await User.findOne({ email: data.email.toLowerCase() });
        if (existingUser) {
            throw new Error('User with this email already exists');
        }

        // Create new user (password will be hashed by pre-save hook)
        const user = new User({
            email: data.email.toLowerCase(),
            password: data.password,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.role || UserRole.CUSTOMER
        });

        await user.save();

        return this.userToAuthUser(user);
    }

    /**
     * Login user and generate tokens
     */
    public async login(email: string, password: string): Promise<LoginResponse> {
        // Find user with password field
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        if (!user) {
            throw new Error('Invalid email or password');
        }

        // Verify password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            throw new Error('Invalid email or password');
        }

        // Generate tokens
        const accessToken = this.generateAccessToken(user);
        const refreshToken = await this.generateRefreshToken(user);

        return {
            accessToken,
            refreshToken,
            user: this.userToAuthUser(user)
        };
    }

    /**
     * Generate access token (short-lived)
     */
    public generateAccessToken(user: IUser): string {
        const payload: JwtPayload = {
            userId: user._id.toString(),
            email: user.email,
            role: user.role
        };

        return jwt.sign(payload, this.accessTokenSecret, {
            expiresIn: this.accessTokenExpiry
        });
    }

    /**
     * Generate refresh token (long-lived) and store in database
     */
    public async generateRefreshToken(user: IUser): Promise<string> {
        const tokenId = Math.random().toString(36).substring(2);
        const payload = {
            tokenId,
            userId: user._id.toString()
        };

        const token = jwt.sign(payload, this.refreshTokenSecret, {
            expiresIn: this.refreshTokenExpiry
        });

        // Store refresh token in database
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

        await RefreshToken.create({
            userId: user._id,
            token,
            expiresAt
        });

        return token;
    }

    /**
     * Verify access token
     */
    public verifyAccessToken(token: string): JwtPayload {
        try {
            const decoded = jwt.verify(token, this.accessTokenSecret) as JwtPayload;
            return decoded;
        } catch (error: any) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Access token has expired');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid access token');
            }
            throw error;
        }
    }

    /**
     * Refresh access token using refresh token
     */
    public async refreshAccessToken(refreshToken: string): Promise<string> {
        try {
            // Verify refresh token
            const decoded = jwt.verify(refreshToken, this.refreshTokenSecret) as any;

            // Check if token exists in database
            const tokenDoc = await RefreshToken.findOne({
                token: refreshToken,
                userId: decoded.userId
            });

            if (!tokenDoc) {
                throw new Error('Invalid refresh token');
            }

            // Check if token is expired
            if (tokenDoc.expiresAt < new Date()) {
                await RefreshToken.deleteOne({ _id: tokenDoc._id });
                throw new Error('Refresh token has expired');
            }

            // Get user
            const user = await User.findById(decoded.userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Generate new access token
            return this.generateAccessToken(user);

        } catch (error: any) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Refresh token has expired');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid refresh token');
            }
            throw error;
        }
    }

    /**
     * Revoke refresh token (logout)
     */
    public async revokeRefreshToken(refreshToken: string): Promise<void> {
        await RefreshToken.deleteOne({ token: refreshToken });
    }

    /**
     * Get user by ID
     */
    public async getUserById(userId: string): Promise<AuthUser | null> {
        const user = await User.findById(userId);
        if (!user) {
            return null;
        }
        return this.userToAuthUser(user);
    }

    /**
     * Get user by email
     */
    public async getUserByEmail(email: string): Promise<AuthUser | null> {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return null;
        }
        return this.userToAuthUser(user);
    }

    /**
     * Convert User document to AuthUser
     */
    private userToAuthUser(user: IUser): AuthUser {
        return {
            id: user._id.toString(),
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role
        };
    }
}

export default new AuthService();
