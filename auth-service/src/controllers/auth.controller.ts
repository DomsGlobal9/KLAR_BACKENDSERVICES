import { Request, Response, NextFunction } from "express";
import {
  getPendingVerificationsService,
  approveVerificationService,
  rejectVerificationService,
} from "../services/adminVerification.service";
import { AuthService } from "../services/auth.service";
import { OTPService } from "../services/otp.service";
import { ClientType } from "../constants/clientTypes";
import { envConfig } from "../config/env.config";
import { UserModel } from "../models/user.model";
import { OTPType } from "../models/otp.model";


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


/**
 * OTP Functionality Begins
 */
export const requestSignupOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log("The REQUEST signup function called");

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const otpDoc = await OTPService.generateOTP(
      email.toLowerCase(),
      OTPType.SIGNUP
    );

    res.status(200).json({
      success: true,
      message: "OTP generated successfully",
      otp: otpDoc.otp,
    });
  } catch (err) {
    next(err);
  }
};

export const verifySignupOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, otp,
      businessName,
      businessType,
      contactPerson,
      businessMobile,
      password,

      gstNumber,
      panNumber,

      address,
      city,
      country,
    } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        status: false,
        message: "Email or OTP not found"
      })
    }

    /**
     * Verify OTP
     */
    await OTPService.verifyOTP(
      email.toLowerCase(),
      otp,
      OTPType.SIGNUP
    );

    /**
     * Create user
     */
    const result = await AuthService.getInstance().signupB2B({
      businessName,
      businessType,
      contactPerson,

      businessEmail: email.toLowerCase(),
      businessMobile,

      password,

      gstNumber,
      panNumber,

      address,
      city,
      country,
    });

    res.status(201).json({
      success: true,
      message: "Signup successful",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * OTP Functionality End here
 */

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
 * OTP SEND FOR LOGIN BEGINS HERE
 */
export const requestLoginOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    /**
     * Verify user credentials first
     */
    await AuthService.getInstance().login({
      email: email.toLowerCase(),
      password,
      clientType: ClientType.B2B,
    });

    /**
     * Generate OTP only after password verification
     */
    const otpDoc = await OTPService.generateOTP(
      email.toLowerCase(),
      OTPType.LOGIN
    );

    res.status(200).json({
      success: true,
      message: "OTP generated successfully",

      /**
       * TEMPORARY FOR TESTING
       */
      otp: otpDoc.otp,
    });
  } catch (err) {
    next(err);
  }
};

export const verifyLoginOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, otp } = req.body;

    /**
     * Verify OTP
     */
    await OTPService.verifyOTP(
      email.toLowerCase(),
      otp,
      OTPType.LOGIN
    );

    /**
     * Find user
     */
    const user = await UserModel.findOne({
      email: email.toLowerCase(),
      clientType: ClientType.B2B,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    /**
     * Generate JWT
     */
    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      clientType: user.clientType,
      roles: user.roles,
    };

    const jwtUtil = AuthService.getInstance()["jwtUtil"];

    const token = jwtUtil.generateAccessToken(
      tokenPayload
    );

    /**
     * Set Cookie
     */
    res.cookie("token", token, {
      httpOnly: envConfig.COOKIE.HTTP_ONLY,
      secure: envConfig.COOKIE.SECURE,
      sameSite: envConfig.COOKIE.SAME_SITE,
      maxAge: envConfig.COOKIE.MAX_AGE,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",

      data: {
        token,

        user: {
          id: user._id,
          email: user.email,
          roles: user.roles,
          clientType: user.clientType,
          status: user.status,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
/**
 * OTP SEND FOR LOGIN END HERE
 */


/**
 * B2B Logout Controller
 * Clears the HTTP-Only auth cookie
 */
export const logoutB2B = async (
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Use maxAge: 0 to force-expire the cookie immediately (most reliable cross-browser)
  res.cookie("token", "", {
    httpOnly: envConfig.COOKIE.HTTP_ONLY,
    secure: envConfig.COOKIE.SECURE,
    sameSite: envConfig.COOKIE.SAME_SITE,
    maxAge: 0,
    expires: new Date(0),
  });
  // Also call clearCookie as a belt-and-suspenders measure
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


/**
 * Validate JWT Token
 * Simply returns 200 if the token is valid (authenticateJWT middleware already validates it)
 */
export const validateToken = async (
  req: Request,
  res: Response,
  _next: NextFunction
) => {

  const user = (req as any).user;

  const userMobile = await UserModel.findById(user.userId).select('mobile');

  res.status(200).json({
    success: true,
    message: "Token is valid",
    data: {
      userId: user.userId,
      email: user.email,
      mobile: userMobile,
      clientType: user.clientType,
      roles: user.roles,
    },
  });
};

export const validateTokenForService = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {

    const user = (req as any).user;

    if (!user || !user.userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication",
        code: "INVALID_AUTH"
      });
    }


    const authService = AuthService.getInstance();
    const fullUser = await authService.getCurrentUser(user.userId);

    if (!fullUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Token validated successfully",
      data: fullUser
    });
  } catch (error) {
    console.error("Token validation error:", error);

    res.status(500).json({
      success: false,
      message: "Token validation failed",
      code: "VALIDATION_FAILED"
    });
  }
};
