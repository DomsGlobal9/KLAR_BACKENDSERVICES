import { Request, Response } from 'express';
import authService from './auth.service';

export class AuthController {
    /**
     * @swagger
     * /auth/register:
     *   post:
     *     summary: Register a new user
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - email
     *               - password
     *               - firstName
     *               - lastName
     *             properties:
     *               email:
     *                 type: string
     *               password:
     *                 type: string
     *                 minLength: 8
     *               firstName:
     *                 type: string
     *               lastName:
     *                 type: string
     *               role:
     *                 type: string
     *                 enum: [customer, agent, admin]
     *     responses:
     *       201:
     *         description: User registered successfully
     *       400:
     *         description: Validation error
     *       409:
     *         description: Email already exists
     */
    public async register(req: Request, res: Response): Promise<void> {
        console.log("Auth Controller: Register called", req.body);
        try {
            const { email, password, firstName, lastName, role } = req.body;

            // Validation
            if (!email || !password || !firstName || !lastName) {
                res.status(400).json({
                    success: false,
                    message: 'Email, password, first name, and last name are required'
                });
                return;
            }

            // Validate email format
            const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
            if (!emailRegex.test(email)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid email format'
                });
                return;
            }

            // Validate password strength
            if (password.length < 8) {
                res.status(400).json({
                    success: false,
                    message: 'Password must be at least 8 characters long'
                });
                return;
            }

            const user = await authService.register({
                email,
                password,
                firstName,
                lastName,
                role
            });

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: user
            });

        } catch (error: any) {
            if (error.message.includes('already exists')) {
                res.status(409).json({
                    success: false,
                    message: error.message
                });
                return;
            }

            res.status(500).json({
                success: false,
                message: 'Registration failed',
                error: error.message
            });
        }
    }

    /**
     * @swagger
     * /auth/login:
     *   post:
     *     summary: Login user
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - email
     *               - password
     *             properties:
     *               email:
     *                 type: string
     *               password:
     *                 type: string
     *     responses:
     *       200:
     *         description: Login successful
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 data:
     *                   type: object
     *                   properties:
     *                     accessToken:
     *                       type: string
     *                     refreshToken:
     *                       type: string
     *       401:
     *         description: Invalid credentials
     */
    public async login(req: Request, res: Response): Promise<void> {
        try {
            const { email, password } = req.body;

            // Validation
            if (!email || !password) {
                res.status(400).json({
                    success: false,
                    message: 'Email and password are required'
                });
                return;
            }

            const result = await authService.login(email, password);

            res.status(200).json({
                success: true,
                message: 'Login successful',
                data: result
            });

        } catch (error: any) {
            if (error.message.includes('Invalid email or password')) {
                res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
                return;
            }

            res.status(500).json({
                success: false,
                message: 'Login failed',
                error: error.message
            });
        }
    }

    /**
     * @swagger
     * /auth/refresh:
     *   post:
     *     summary: Refresh access token
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - refreshToken
     *             properties:
     *               refreshToken:
     *                 type: string
     *     responses:
     *       200:
     *         description: Token refreshed
     *       401:
     *         description: Invalid refresh token
     */
    public async refreshToken(req: Request, res: Response): Promise<void> {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                res.status(400).json({
                    success: false,
                    message: 'Refresh token is required'
                });
                return;
            }

            const newAccessToken = await authService.refreshAccessToken(refreshToken);

            res.status(200).json({
                success: true,
                message: 'Token refreshed successfully',
                data: {
                    accessToken: newAccessToken
                }
            });

        } catch (error: any) {
            res.status(401).json({
                success: false,
                message: error.message || 'Token refresh failed'
            });
        }
    }

    /**
     * @swagger
     * /auth/logout:
     *   post:
     *     summary: Logout user
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - refreshToken
     *             properties:
     *               refreshToken:
     *                 type: string
     *     responses:
     *       200:
     *         description: Logged out successfully
     */
    public async logout(req: Request, res: Response): Promise<void> {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                res.status(400).json({
                    success: false,
                    message: 'Refresh token is required'
                });
                return;
            }

            await authService.revokeRefreshToken(refreshToken);

            res.status(200).json({
                success: true,
                message: 'Logged out successfully'
            });

        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: 'Logout failed',
                error: error.message
            });
        }
    }

    /**
     * @swagger
     * /auth/profile:
     *   get:
     *     summary: Get current user profile
     *     tags: [Auth]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: User profile
     *       401:
     *         description: Not authenticated
     */
    public async getProfile(req: Request, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    message: 'Not authenticated'
                });
                return;
            }

            res.status(200).json({
                success: true,
                data: req.user
            });

        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: 'Failed to get profile',
                error: error.message
            });
        }
    }
}

export default new AuthController();
