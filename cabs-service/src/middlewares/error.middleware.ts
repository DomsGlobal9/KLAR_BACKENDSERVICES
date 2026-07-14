import { Request, Response, NextFunction } from "express";
import { StructuredError, ERROR_CODE_STATUS } from "../services/StructuredError";

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  // StructuredError -> stable code + mapped HTTP status.
  if (err instanceof StructuredError) {
    const status = ERROR_CODE_STATUS[err.code] || 400;
    console.error(`[Error] ${status} ${err.code} - ${err.message}`);
    return res.status(status).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // Legacy `{ status, message, data }` throws and unexpected errors.
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  const data = err.data || err.response?.data || null;

  console.error(`[Error] ${status} - ${message}`, err?.stack || err);

  res.status(status).json({
    success: false,
    message,
    ...(data ? { data } : {}),
  });
};
