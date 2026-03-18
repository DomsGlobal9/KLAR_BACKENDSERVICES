import { Request, Response, NextFunction } from "express";

export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    console.error("Error path:", req.path);
    console.error("Error stack:", err.stack);

    // 🔍 Enhanced logging for Axios errors
    if (err.response) {
        console.error("API Error Response Status:", err.response.status);
        console.error("API Error Response Data:", JSON.stringify(err.response.data, null, 2));
        console.error("API Error Response Headers:", err.response.headers);
    }

    const statusCode = err.response?.status || err.status || 500;
    const message = err.response?.data?.message || err.message || "Something went wrong on the server";

    res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === "development" ? err.stack : undefined,
        details: process.env.NODE_ENV === "development" ? err.response?.data : undefined,
    });
};
