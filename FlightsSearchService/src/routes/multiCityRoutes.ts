import { Router } from "express";
import { clearMultiCitySession, getMultiCityFlightBySegmentId, getMultiCityLegFlights, getMultiCityNextPage, searchMultiCity } from "../controllers/multiCityController";

const router = Router();

router.post("/search", searchMultiCity);
router.get("/next/:sessionId", getMultiCityNextPage);
router.get("/leg/:sessionId/:legKey", getMultiCityLegFlights);
router.get("/flight/:sessionId/:segmentId", getMultiCityFlightBySegmentId);
router.delete("/session/:sessionId", clearMultiCitySession);


export default router;