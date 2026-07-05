import { Router } from "express";
import {
  signupB2B,
  loginB2B,
  logoutB2B,
  me,
  validateToken,
  validateTokenForService,
  requestSignupOTP,
  verifySignupOTP,
  requestLoginOTP,
  verifyLoginOTP,
  requestForgotPasswordOTP,
  verifyForgotPasswordOTP,
  resetPassword,
  requestGuestOTP,
  verifyGuestOTP,
  changePassword,
  updateProfile,
  updateAddress,
} from "../controllers/auth.controller";
import { authenticateJWT } from "../middlewares/authentication.middleware";

const router = Router();

router.post("/signup", signupB2B);
router.post("/login", loginB2B);
router.post("/logout", logoutB2B);
router.get("/me", authenticateJWT, me);
router.get("/validate", authenticateJWT, validateToken);

/**
 * OTP sending and verifications
 */
router.post("/signup/request-otp", requestSignupOTP);
router.post("/signup/verify-otp", verifySignupOTP);
router.post("/login/request-otp", requestLoginOTP);
router.post("/login/verify-otp", verifyLoginOTP);

/**
 * Guest/B2C Booking access routes
 */
router.post("/guest/request-otp", requestGuestOTP);
router.post("/guest/verify-otp", verifyGuestOTP);

/**
 * Forgot password flow: request OTP, verify OTP, reset password
 */
router.post("/forgot-password/request-otp", requestForgotPasswordOTP);
router.post("/forgot-password/verify-otp", verifyForgotPasswordOTP);
router.post("/forgot-password/reset", resetPassword);

/**
 * endpoint for service-to-service validation 
 */
router.post("/validate-token", authenticateJWT, validateTokenForService);


router.post("/change-password", authenticateJWT, changePassword);
router.patch("/profile/update", authenticateJWT, updateProfile);
router.patch("/profile/address", authenticateJWT, updateAddress);


export default router;