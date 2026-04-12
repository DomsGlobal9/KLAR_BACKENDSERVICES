import { Router } from "express";
import { getMultiCityFlightBySegmentId, searchMultiCity } from "../controllers/multiCityController";

const router = Router();

router.post("/search", searchMultiCity);
router.get("/flight/:sessionId/:segmentId", getMultiCityFlightBySegmentId);

export default router;