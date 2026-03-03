
import { Router } from "express";
import { getAvailableSeats, getSeatMap, getSeatMapWithRecommendations } from "../controllers/seatController";

const router = Router();

router.post("/", getSeatMap);

router.post("/available", getAvailableSeats);

router.post("/recommend", getSeatMapWithRecommendations);

export default router;