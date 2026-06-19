import { Router } from "express";
import rmRoutes from "./rm.routes";
import authRoutes from "./auth.routes";
import adminRoutes from "./admin.routes";
import walletRoutes from "./wallet.routes";
import markupRoutes from "./markup.routes";
import companyRoutes from "./company.routes";
import b2cAuthRoutes from "./b2cAuth.routes";
import dashboardRoutes from "./dashboard.routes";
import bookingRoutes from "./bookingPayment.routes";

const router = Router();


router.get("/health", (_req, res) => {
    res.json({ status: "OK" });
});

router.use("/rm", rmRoutes);
router.use("/auth", authRoutes);
router.use("/book", bookingRoutes);
router.use("/wallet", walletRoutes);
router.use("/markup", markupRoutes);
router.use("/company", companyRoutes);
router.use("/auth/b2c", b2cAuthRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/admin/verifications", adminRoutes);


export default router;