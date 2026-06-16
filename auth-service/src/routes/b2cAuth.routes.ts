import { Router } from "express";
import { B2CAuthController } from "../controllers/b2cAuth.controller";
import { authenticateJWT } from "../middlewares/authentication.middleware";

const router = Router();
const authController = B2CAuthController.getInstance();

// Public routes
router.post("/register", authController.register);
router.post("/login", authController.login);

// Protected routes (require authentication)
router.get("/me", authenticateJWT, authController.getMe);
router.put("/profile", authenticateJWT, authController.updateProfile);
router.post("/change-password", authenticateJWT, authController.changePassword);

/**
 * OTP routes for B2C
 */
router.post("/signup/request-otp", authController.requestSignupOTP);
router.post("/signup/verify-otp", authController.verifySignupOTP);
router.post("/login/request-otp", authController.requestLoginOTP);
router.post("/login/verify-otp", authController.verifyLoginOTP);


/**
 * Google login
 */

router.post("/google", authController.googleAuth);

router.post("/validate-token", authenticateJWT, authController.validateToken);

/**
 * Forgot Password / Password Reset routes
 */
router.post("/forgot-password/request-otp", authController.requestPasswordResetOTP);
router.post("/forgot-password/reset", authController.resetPassword);

export default router;