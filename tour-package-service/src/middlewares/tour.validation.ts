import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { DestinationType, PortalSource } from "../types/tour.types";

export const createTourQuerySchema = z.object({
  destinationType: z.nativeEnum(DestinationType, {
    message: "Destination type is required",
  }),
  fullName: z
    .string({ message: "Full name is required" })
    .min(4, "Full name is required")
    .min(4, "Full name must be at least 4 characters")
    .trim(),
  contactNumber: z
    .string({ message: "Contact number is required" })
    .min(1, "Contact number is required")
    .regex(/^[0-9]{10,15}$/, "Please enter a valid contact number (10-15 digits)"),
  email: z
    .string({ message: "Email address is required" })
    .min(1, "Email address is required")
    .email("Invalid email address format")
    .toLowerCase()
    .trim(),
  destinationName: z
    .string({ message: "Destination name is required" })
    .min(1, "Destination name is required")
    .min(2, "Destination name must be at least 2 characters")
    .trim(),
  travelDate: z.coerce
    .date({ message: "Travel date is required" })
    .refine((date) => date >= new Date(new Date().setHours(0, 0, 0, 0)), {
      message: "Travel date cannot be in the past",
    }),
  numberOfTravellers: z
    .number({ message: "Number of travellers is required" })
    .int("Number of travellers must be an integer")
    .positive("Number of travellers must be at least 1"),
  specialRequirements: z.string().optional(),
  source: z.nativeEnum(PortalSource, {
    message: "Source portal (B2B or B2C) is required",
  }),
});

export const validateTourQuery = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = createTourQuerySchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    next(error);
  }
};