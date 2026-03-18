import { Router } from "express";
import { 
  signupB2B, 
  loginB2B, 
  logoutB2B, 
  me, 
  validateToken,
  validateTokenForService, 
} from "../controllers/auth.controller";
import { authenticateJWT } from "../middlewares/authentication.middleware";

const router = Router();

router.post("/signup", signupB2B);
router.post("/login", loginB2B);
router.post("/logout", logoutB2B);
router.get("/me", authenticateJWT, me);
router.get("/validate", authenticateJWT, validateToken);

/**
 * endpoint for service-to-service validation 
 */ 
router.post("/validate-token", authenticateJWT, validateTokenForService);


export default router;