import { Request, Response, NextFunction } from "express";
import { B2CAuthService } from "../services/b2cAuth.service";

export class B2CAuthController {
    private static instance: B2CAuthController;
    private authService: B2CAuthService;

    private constructor() {
        this.authService = B2CAuthService.getInstance();
    }

    public static getInstance(): B2CAuthController {
        if (!B2CAuthController.instance) {
            B2CAuthController.instance = new B2CAuthController();
        }
        return B2CAuthController.instance;
    }

    /**
     * Register a new B2C user
     * POST /api/b2c/auth/register
     */
    register = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { fullName, email, password, mobileNumber } = req.body;

            // Validation
            if (!fullName || !email || !password || !mobileNumber) {
                return res.status(400).json({
                    success: false,
                    message: "All fields are required: fullName, email, password, mobileNumber",
                });
            }

            // Email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid email format",
                });
            }

            // Mobile number validation (10 digits)
            const mobileRegex = /^\d{10}$/;
            if (!mobileRegex.test(mobileNumber)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid mobile number. Please enter 10 digits",
                });
            }

            const result = await this.authService.register({
                fullName,
                email,
                password,
                mobileNumber,
            });

            res.status(201).json({
                success: true,
                message: result.message,
            });
        } catch (err) {
            next(err);
        }
    };

    /**
     * Login B2C user with email and password
     * POST /api/b2c/auth/login
     */
    login = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, password } = req.body;

            // Validation
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Email and password are required",
                });
            }

            // Get client IP
            const ipAddress = req.ip || req.socket.remoteAddress;

            const result = await this.authService.loginWithEmail({
                email,
                password,
                ipAddress,
            });

            res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    user: result.user,
                    token: result.token,
                },
            });
        } catch (err) {
            next(err);
        }
    };


    /**
     * Google Login
     * POST /api/b2c/auth/google
     */
    googleAuth = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { idToken } = req.body;

            // Validate request
            if (!idToken) {
                return res.status(400).json({
                    success: false,
                    message: "ID token is required",
                });
            }

            // Get client IP
            const ipAddress = req.ip || req.socket.remoteAddress;

            const result = await this.authService.googleAuth(idToken, ipAddress);

            res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    token: result.token,
                    user: result.user,
                },
            });
        } catch (err) {
            next(err);
        }
    };

    /**
     * Get current user profile
     * GET /api/b2c/auth/me
     */
    getMe = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req as any).user.userId;
            const user = await this.authService.getCurrentUser(userId);

            res.status(200).json({
                success: true,
                data: {
                    user,
                },
            });
        } catch (err) {
            next(err);
        }
    };

    /**
     * Update user profile
     * PUT /api/b2c/auth/profile
     */
    updateProfile = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req as any).user.userId;
            const { fullName, mobileNumber } = req.body;

            const updatedUser = await this.authService.updateProfile(userId, {
                fullName,
                mobileNumber,
            });

            res.status(200).json({
                success: true,
                message: "Profile updated successfully",
                data: {
                    user: updatedUser,
                },
            });
        } catch (err) {
            next(err);
        }
    };

    /**
     * Change password
     * POST /api/b2c/auth/change-password
     */
    changePassword = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req as any).user.userId;
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    message: "Current password and new password are required",
                });
            }

            await this.authService.changePassword(userId, currentPassword, newPassword);

            res.status(200).json({
                success: true,
                message: "Password changed successfully",
            });
        } catch (err) {
            next(err);
        }
    };

    // Add these methods to B2CAuthController class

    /**
     * Request OTP for signup
     * POST /api/b2c/auth/signup/request-otp
     */
    requestSignupOTP = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: "Email is required",
                });
            }

            // Email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid email format",
                });
            }

            const result = await this.authService.requestSignupOTP(email);

            res.status(200).json({
                success: true,
                message: result.message,
                otp: result.otp,
            });
        } catch (err) {
            next(err);
        }
    };

    /**
     * Verify OTP and complete signup
     * POST /api/b2c/auth/signup/verify-otp
     */
    verifySignupOTP = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { fullName, email, password, mobileNumber, otp } = req.body;

            // Validation
            if (!fullName || !email || !password || !mobileNumber || !otp) {
                return res.status(400).json({
                    success: false,
                    message: "All fields are required: fullName, email, password, mobileNumber, otp",
                });
            }

            // Email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid email format",
                });
            }

            // Mobile number validation (10 digits)
            const mobileRegex = /^\d{10}$/;
            if (!mobileRegex.test(mobileNumber)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid mobile number. Please enter 10 digits",
                });
            }

            const result = await this.authService.verifySignupAndRegister({
                fullName,
                email,
                password,
                mobileNumber,
                otp,
            });

            res.status(201).json({
                success: true,
                message: result.message,
            });
        } catch (err) {
            next(err);
        }
    };

    /**
     * Request OTP for login 2FA
     * POST /api/b2c/auth/login/request-otp
     */
    requestLoginOTP = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Email and password are required",
                });
            }

            const result = await this.authService.requestLoginOTP(email, password);

            res.status(200).json({
                success: true,
                message: result.message,
                otp: result.otp, // Remove in production
            });
        } catch (err) {
            next(err);
        }
    };

    /**
     * Verify login OTP and complete authentication
     * POST /api/b2c/auth/login/verify-otp
     */
    verifyLoginOTP = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, otp } = req.body;

            if (!email || !otp) {
                return res.status(400).json({
                    success: false,
                    message: "Email and OTP are required",
                });
            }

            // Get client IP
            const ipAddress = req.ip || req.socket.remoteAddress;

            const result = await this.authService.verifyLoginAndAuthenticate(email, otp, ipAddress);

            res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    token: result.token,
                },
            });
        } catch (err) {
            next(err);
        }
    };

    validateToken = async (req: Request, res: Response, _next: NextFunction) => {
        const user = (req as any).user;

        res.status(200).json({
            success: true,
            message: "Token is valid",
            data: {
                userId: user.userId,
                email: user.email,
                clientType: user.clientType,
                roles: user.roles,
            },
        });
    };

    /**
 * Request OTP for password reset
 * POST /api/b2c/auth/forgot-password/request-otp
 */
requestPasswordResetOTP = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, mobileNumber } = req.body;

        // Validation
        if (!email || !mobileNumber) {
            return res.status(400).json({
                success: false,
                message: "Email and mobile number are required",
            });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format",
            });
        }

        // Mobile number validation (10 digits)
        const mobileRegex = /^\d{10}$/;
        if (!mobileRegex.test(mobileNumber)) {
            return res.status(400).json({
                success: false,
                message: "Invalid mobile number. Please enter 10 digits",
            });
        }

        const result = await this.authService.requestPasswordResetOTP(email, mobileNumber);

        res.status(200).json({
            success: true,
            message: result.message,
            // Remove OTP in production
            ...(process.env.NODE_ENV !== 'production' && { otp: result.otp }),
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Verify OTP and reset password
 * POST /api/b2c/auth/forgot-password/reset
 */
resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, newPassword } = req.body;

        // Validation
        if (!email || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Email, and new password are required",
            });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format",
            });
        }

        // Password validation
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters",
            });
        }

        await this.authService.resetPassword(email, newPassword);

        res.status(200).json({
            success: true,
            message: "Password reset successfully. You can now login with your new password.",
        });
    } catch (err) {
        next(err);
    }
};


}

export default B2CAuthController;