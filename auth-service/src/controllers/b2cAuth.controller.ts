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

    
}

export default B2CAuthController;