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

export default router;