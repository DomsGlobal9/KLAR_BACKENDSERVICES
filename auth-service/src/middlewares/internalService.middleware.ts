import { Request, Response, NextFunction } from "express";

/**
 * Guards routes that are called by other Klar services rather than by a user.
 *
 * A user JWT identifies who the caller *is*, which is the wrong shape for
 * background work: the reconciliation worker has to credit the wallet of the
 * agent who owns a stuck booking, not the wallet of whoever's token it holds.
 * These routes take an explicit `userId` and are gated on a shared secret
 * instead.
 *
 * Fails closed: if INTERNAL_SERVICE_KEY is unset the route is unreachable.
 */
export const internalServiceAuth = (
    req: Request,
    res: Response,
    next: NextFunction
): Response | void => {
    const expected = process.env.INTERNAL_SERVICE_KEY;




    if (!expected) {
        console.error(
            "[internalServiceAuth] INTERNAL_SERVICE_KEY is not configured. Rejecting internal request."
        );
        return res.status(503).json({
            success: false,
            message: "Internal service authentication is not configured.",
        });
    }

    const provided = req.headers["x-internal-key"];


    

    if (typeof provided !== "string" || provided !== expected) {

        return res.status(401).json({
            success: false,
            message: "Invalid internal service key.",
        });
    }


    next();
};