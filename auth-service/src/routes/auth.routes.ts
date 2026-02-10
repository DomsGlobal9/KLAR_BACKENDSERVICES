import { Router } from "express";
import { signupB2B, loginB2B, logoutB2B, me } from "../controllers/auth.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

// B2B Auth Routes
router.post("/signup", signupB2B);
router.post("/login", loginB2B);
router.post("/logout", logoutB2B);
router.get("/me", authenticateJWT, me);

export default router;
