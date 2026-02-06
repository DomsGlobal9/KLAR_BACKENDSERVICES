import { Router } from "express";
import flightRoutes from "./flightRoutes";
import searchSessionRoutes from "./searchSession.routes";
import healthRoutes from "./health.routes";

const router = Router();

router.get("/ping", (req, res) => {
    res.json({ success: true, message: "API working!" });
});

router.use("/flights", flightRoutes);
router.use("/search-sessions", searchSessionRoutes);
router.use("/health", healthRoutes);

export default router;
