import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { createCharterSchema } from "../utils/charterValidation";

export const validateCharterQuote = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = await createCharterSchema.parseAsync(req.body);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    next(error);
  }
};