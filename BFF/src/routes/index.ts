import { Router } from "express";
import dashboardRoutes from "./dashboard.routes";

const router = Router();

router.get("/health", (req, res) => {
    res.json({ status: "OK", service: "Klar-BFF" });
});

router.use("/dashboard", dashboardRoutes);

export default router;
