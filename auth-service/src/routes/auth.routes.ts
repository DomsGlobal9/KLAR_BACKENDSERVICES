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
 * endpoint for service-to-service validation 
 */
router.post("/validate-token", authenticateJWT, validateTokenForService);


export default router;