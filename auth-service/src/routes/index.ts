import { Router } from "express";
import authRoutes from "./auth.routes";
import adminRoutes from "./admin.routes";
import walletRoutes from "./wallet.routes";

const router = Router();

router.get("/health", (_req, res) => {
    res.json({ status: "OK" });
});

router.use("/auth", authRoutes);
router.use("/admin/verifications", adminRoutes);
router.use("/wallet", walletRoutes);

export default router;
