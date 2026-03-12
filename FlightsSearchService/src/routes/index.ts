import { Router } from "express";
import flightRoutes from "./flightRoutes";
import searchSessionRoutes from "./searchSession.routes";
import healthRoutes from "./health.routes";
import reviewRoutes from "./reviewRoutes";
import fareRule from "./fareRuleRoutes";
import reviewRule from "./reviewRoutes";
import flightSeat from "./flightSeatRoute";
import flightBooking from "./bookingRoutes";
import bookingDetails from "./bookingDetails.routes";

import { authenticateJWT } from "../middleware/auth.middleware";

const router = Router();

router.get("/ping", (req, res) => {
    res.json({ success: true, message: "API working!" });
});

router.use("/flights/fare-rule", authenticateJWT, fareRule);
router.use("/flights/review", authenticateJWT, reviewRule);
router.use("/flights/seat", authenticateJWT, flightSeat);
router.use("/flights/booking", authenticateJWT, flightBooking);
router.use("/flights/booking-details", authenticateJWT, bookingDetails);
router.use("/flights", authenticateJWT, flightRoutes);
router.use("/search-sessions", authenticateJWT, searchSessionRoutes);
router.use("/health", healthRoutes);
router.use("/api/flightsreview", authenticateJWT, reviewRoutes);

export default router;
