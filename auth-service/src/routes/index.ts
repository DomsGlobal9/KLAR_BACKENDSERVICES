import { Router } from "express";
import authRoutes from "./auth.routes";
import adminRoutes from "./admin.routes";
import walletRoutes from "./wallet.routes";
import markupRoutes from "./markup.routes"
import dashboardRoutes from "./dashboard.routes"

const router = Router();


router.get("/health", (_req, res) => {
    res.json({ status: "OK" });
});

router.use("/markup", markupRoutes);
router.use("/auth", authRoutes);
router.use("/admin/verifications", adminRoutes);
router.use("/wallet", walletRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
