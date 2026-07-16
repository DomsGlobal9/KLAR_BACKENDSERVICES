import { Router } from "express";
import { searchAirportsController } from "../controllers/airport.controller";

const router = Router();

router.get("/", searchAirportsController);

export default router;
