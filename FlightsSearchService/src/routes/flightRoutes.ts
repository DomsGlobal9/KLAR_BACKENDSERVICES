import { Router } from "express";
import {
    getAllFlightsWithDetails,
    getFlightDetails,
    getSegmentById,
    getTransformedSegmentById,
    searchFlights
} from "../controllers/flightSearchController";

const router = Router();

router.post("/search", searchFlights);

/**
* POST /api/flights/search?primary=CHEAPEST&secondary=EARLY_DEPARTURE
* POST /api/flights/search?primary=QUICKEST&secondary=EARLY_ARRIVAL
* POST /api/flights/search?primary=CHEAPEST&secondary=NONE
*/


router.post("/:flightId", getFlightDetails);
router.post("/all-details", getAllFlightsWithDetails);

router.post("/segment/:segmentId", getSegmentById);

router.post("/segment/transformed/:segmentId", getTransformedSegmentById);

export default router;

