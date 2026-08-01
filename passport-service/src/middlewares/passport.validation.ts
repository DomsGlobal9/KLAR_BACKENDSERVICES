import { Request, Response, NextFunction } from "express";
import { z } from "zod";

const SOURCES = ["b2b", "b2c"] as const;

const SERVICES = [
  "New passport",
  "Renewal",
  "Reissue",
  "Police Clearance Certificate",
] as const;

const APPLICANTS = ["Adult", "Minor"] as const;

export const createPassportQuoteSchema = z.object({
  source: z.enum(SOURCES, {
    message: "Source must be either 'b2b' or 'b2c'",
  }),
  service: z.enum(SERVICES, {
    message: "Invalid or missing service type selected",
  }),
  applicant: z.enum(APPLICANTS, {
    message: "Applicant must be either Adult or Minor",
  }),
  city: z
    .string({ message: "City is required" })
    .min(2, "City name must be at least 2 characters")
    .trim(),
  fullName: z
    .string({ message: "Full name is required" })
    .min(3, "Full name must be at least 3 characters")
    .trim(),
  mobileNumber: z
    .string({ message: "Mobile number is required" })
    .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit mobile number")
    .trim(),
  emailId: z
    .string({ message: "Email ID is required" })
    .email("Please enter a valid email address")
    .toLowerCase()
    .trim(),
});

export const validatePassportQuote = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    createPassportQuoteSchema.parse(req.body);
    next();
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.issues.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      });
    }
    next(error);
  }
};