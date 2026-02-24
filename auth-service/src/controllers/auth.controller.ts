import { Request, Response, NextFunction } from "express";
import {
  getPendingVerificationsService,
  approveVerificationService,
  rejectVerificationService,
} from "../services/adminVerification.service";
import { AuthService } from "../services/auth.service";
import { ClientType } from "../constants/clientTypes";
import { envConfig } from "../config/env.config";

export const signupB2B = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await AuthService.getInstance().signupB2B(req.body);
    res.status(201).json({
      success: true,
      message: "Signup successful",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const getPendingVerifications = async (

  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const users = await getPendingVerificationsService();
    res.status(200).json({
      success: true,
      message: "Pending verifications fetched successfully",
      data: users,
    });
  } catch (err) {
    next(err);
  }
};

export const approveVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await approveVerificationService(req.params.userId as string);
    res.status(200).json({
      success: true,
      message: "Verification approved",
    });
  } catch (err) {
    next(err);
  }
};

export const rejectVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { remarks } = req.body;
    await rejectVerificationService(req.params.userId as string, remarks);
    res.status(200).json({
      success: true,
      message: "Verification rejected",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * B2B Login Controller
 * Production-ready with proper validation and error handling
 * Sets HTTP-Only Secure cookie instead of returning token in body
 */
export const loginB2B = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    if (!password || typeof password !== "string") {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    const result = await AuthService.getInstance().login({
      email: email.trim().toLowerCase(),
      password,
      clientType: ClientType.B2B,
    });

    // Set HTTP-Only Secure cookie only if token exists (ACTIVE status)
    if (result.token) {
      res.cookie("token", result.token, {
        httpOnly: envConfig.COOKIE.HTTP_ONLY,
        secure: envConfig.COOKIE.SECURE,
        sameSite: envConfig.COOKIE.SAME_SITE,
        maxAge: envConfig.COOKIE.MAX_AGE,
      });
    }

    res.status(200).json({
      success: true,
      message: result.token ? "Login successful" : "Account status retrieved",
      data: {
        user: result.user,
      },
    });
  } catch (err) {
    // Let the error middleware handle known errors
    next(err);
  }
};

/**
 * B2B Logout Controller
 * Clears the HTTP-Only auth cookie
 */
export const logoutB2B = async (
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  res.clearCookie("token", {
    httpOnly: envConfig.COOKIE.HTTP_ONLY,
    secure: envConfig.COOKIE.SECURE,
    sameSite: envConfig.COOKIE.SAME_SITE,
  });

  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
};

/**
 * Get current user profile
 */
export const me = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user.userId;
    const user = await AuthService.getInstance().getCurrentUser(userId);

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

