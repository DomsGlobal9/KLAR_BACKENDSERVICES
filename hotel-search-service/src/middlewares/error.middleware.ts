import { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error(" Error:", err);

  console.error(" Error Stack:", err.stack);
  console.error(" Full Error Object:", JSON.stringify(err, null, 2));

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {})
  });
};
