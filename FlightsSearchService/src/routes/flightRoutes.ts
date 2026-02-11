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
router.post("/:flightId", getFlightDetails);
router.post("/all-details", getAllFlightsWithDetails);

router.post("/segment/:segmentId", getSegmentById);

router.post("/segment/transformed/:segmentId", getTransformedSegmentById);

export default router;

