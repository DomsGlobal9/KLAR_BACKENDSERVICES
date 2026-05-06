import { Request, Response, NextFunction } from "express";

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || 500;
    const message = err.message || "Internal Server Error";
    const data = err.data || null;

    console.error(`[Error] ${status} - ${message}`, err);

    res.status(status).json({
        success: false,
        message,
        ...(data && { data })
    });
};
