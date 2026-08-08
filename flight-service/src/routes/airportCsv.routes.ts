import { Router } from "express";
import { searchAirportsCsvController } from "../controllers/airportCsv.controller";

const router = Router();

router.get("/", searchAirportsCsvController);

export default router;
