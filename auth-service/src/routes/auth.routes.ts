import { Router } from "express";
import { signupB2B, loginB2B, logoutB2B } from "../controllers/auth.controller";

const router = Router();

// B2B Auth Routes
router.post("/signup", signupB2B);
router.post("/b2b/auth/login", loginB2B);
router.post("/b2b/auth/logout", logoutB2B);

export default router;
