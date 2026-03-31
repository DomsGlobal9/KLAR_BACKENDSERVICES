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
* @ SOTRING 
* POST /search?primary=CHEAPEST&secondary=EARLY_DEPARTURE
* POST /search?primary=QUICKEST&secondary=EARLY_ARRIVAL
* POST /search?primary=CHEAPEST&secondary=NONE
*/

/**
 * Filter by stops
 * GET /api/flights/search?stops=NON_STOP
 * GET /api/flights/search?stops=NON_STOP&stops=ONE_STOP
 * GET /api/flights/search?stops=TWO_PLUS_STOPS
 */

/**
 * Filter by refund type
 * GET /api/flights/search?refundType=REFUNDABLE
 * GET /api/flights/search?refundType=NON_REFUNDABLE
 * GET /api/flights/search?refundType=HOLD_AVAILABLE
 */

/**
 * Filter by price range
 * GET /api/flights/search?minPrice=2000&maxPrice=5000
 */

/**
 * Filter by arrival time
 * GET /api/flights/search?arrivalTime=BEFORE_6AM
 * GET /api/flights/search?arrivalTime=6AM_TO_12PM&arrivalTime=12PM_TO_6PM
 */

/**
 * Pagination Section
 * GET /api/flights/search?page=1&limit=20
 * GET /api/flights/search?page=2&limit=10
 */


router.post("/:flightId", getFlightDetails);

router.post("/all-details", getAllFlightsWithDetails);

router.post("/segment/:segmentId", getSegmentById);

router.post("/segment/transformed/:segmentId", getTransformedSegmentById);

export default router;

