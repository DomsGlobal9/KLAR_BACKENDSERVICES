import { z } from "zod";

export const CHARTER_CATEGORIES = [
  "Private Jets",
  "Helicopter Charter",
  "Corporate Charter",
  "Group Charter",
] as const;

export const createCharterSchema = z.object({
  from: z
    .string({ message: "Source location is required" })
    .min(2, "Source must be at least 2 characters")
    .trim(),
  to: z
    .string({ message: "Destination location is required" })
    .min(2, "Destination must be at least 2 characters")
    .trim(),
  departureDateTime: z
    .string({ message: "Departure Date & Time is required" })
    .datetime({
      message:
        "Invalid date format. Expected ISO date format (e.g., YYYY-MM-THH:mm:ssZ)",
    }),
  passengers: z
    .number({ message: "Passengers count is required" })
    .int("Passenger count must be an integer")
    .min(1, "At least 1 passenger is required"),
  category: z.enum(CHARTER_CATEGORIES, {
    message: "Please select a valid charter category",
  }),
  fullName: z
    .string({ message: "Full Name is required" })
    .min(2, "Full Name must be at least 2 characters")
    .trim(),
  mobileNumber: z
    .string({ message: "Mobile number is required" })
    .regex(/^[0-9]{10,15}$/, "Invalid mobile number format"),
  email: z
    .string({ message: "Email ID is required" })
    .email("Invalid email address")
    .toLowerCase()
    .trim(),
  source: z.enum(["b2b", "b2c"], {
    message: "Source must be either 'b2b' or 'b2c'",
  }),
});

export type CreateCharterInput = z.infer<typeof createCharterSchema>;