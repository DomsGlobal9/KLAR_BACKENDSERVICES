import { Router } from "express";
import { searchFlights } from "../controllers/flightSearchController";

const router = Router();

router.post("/search", searchFlights);

export default router;
