import { Router } from "express";
import { 
    filterFlightsController, 
    getFlightByIdController, 
    getFlightsByAirlineController, 
    getUniqueFlightsController, 
    searchFlights 
} from "../controllers/flightSearchController";

const router = Router();

router.post("/search", searchFlights);
router.post("/filter", filterFlightsController);
router.post('/flight/:id', getFlightByIdController); 
router.post('/flight-by-id', getFlightByIdController); 
router.post('/unique-flights', getUniqueFlightsController);
router.post('/airline-flights', getFlightsByAirlineController);

export default router;

