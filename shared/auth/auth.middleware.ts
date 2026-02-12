import { Request, Response, NextFunction } from 'express';
import authService from './auth.service';
import { UserRole } from '../db/models/User.model';
import { AuthUser } from './auth.service';

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

/**
 * Middleware to authenticate requests using JWT
 */
/**
 * Middleware to authenticate requests using JWT
 * MODIFIED: Bypassing auth for development flow
 */
export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // BYPASS AUTH - Inject dummy user
        const dummyUser: AuthUser = {
            id: 'dummy-user-id',
            email: 'dev@klar-hotels.com',
            firstName: 'Developer',
            lastName: 'User',
            role: UserRole.ADMIN
        };

        req.user = dummyUser;
        next();

    } catch (error: any) {
        console.error('Auth bypass error:', error);
        res.status(500).json({
            success: false,
            message: 'Auth bypass failed'
        });
    }
};

/**
 * Middleware to check if user has required role
 */
export const requireRole = (...roles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        if (!roles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                message: 'Insufficient permissions. Required role: ' + roles.join(' or ')
            });
            return;
        }

        next();
    };
};

/**
 * Optional authentication - attaches user if token is valid, but doesn't fail if no token
 */
export const optionalAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            next();
            return;
        }

        const token = authHeader.substring(7);
        const decoded = authService.verifyAccessToken(token);
        const user = await authService.getUserById(decoded.userId);

        if (user) {
            req.user = user;
        }

        next();
    } catch (error) {
        // Fail silently for optional auth
        next();
    }
};
