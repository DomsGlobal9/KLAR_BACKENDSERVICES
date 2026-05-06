import { Request, Response, NextFunction } from "express";

export const errorHandler = (
    err: any,
    _req: Request,
    res: Response,
    _next: NextFunction
) => {
    console.error("💥 [Insurance] Error:", err?.message || err);

    const status = err.response?.status || err.status || 500;
    const details = err.response?.data || null;

    res.status(status).json({
        success: false,
        message: err.message || "Internal Server Error",
        details,
    });
};
