import { Request, Response, NextFunction } from 'express';

/**
 * Guards routes callable only by other Klar services, never by a browser.
 *
 * Refunds move real money, so this fails closed: with INTERNAL_SERVICE_KEY
 * unset the route is unreachable rather than open.
 */
export const internalServiceAuth = (
    req: Request,
    res: Response,
    next: NextFunction
): Response | void => {
    const expected = process.env.INTERNAL_SERVICE_KEY;

    if (!expected) {
        console.error(
            '[internalServiceAuth] INTERNAL_SERVICE_KEY is not configured. Rejecting internal request.'
        );
        return res.status(503).json({
            success: false,
            message: 'Internal service authentication is not configured.'
        });
    }

    const provided = req.headers['x-internal-key'];

    if (typeof provided !== 'string' || provided !== expected) {
        return res.status(401).json({
            success: false,
            message: 'Invalid internal service key.'
        });
    }

    next();
};
