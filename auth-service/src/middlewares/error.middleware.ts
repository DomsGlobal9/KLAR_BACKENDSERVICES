import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";

export const errorHandler = (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
) => {
    // Handle known operational errors
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
        });
    }

    // Log unexpected errors in production
    console.error("Unexpected error:", err);

    // Don't leak internal error details in production
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === "production"
            ? "Internal Server Error"
            : err.message || "Internal Server Error",
    });
};

