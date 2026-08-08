import { Router } from "express";
import {    
    searchMulticityController,
    searchOneWayController, 
    searchReturnController, 
} from "../controllers/search.controller";

import airportRoutes from "./airport.routes";
import airportCsvRoutes from "./airportCsv.routes";

const router = Router();

router.use("/airports", airportRoutes);
router.use("/airports-csv", airportCsvRoutes);
router.post("/oneway", searchOneWayController);
router.post("/return", searchReturnController);
router.post("/multicity", searchMulticityController);


export default router;