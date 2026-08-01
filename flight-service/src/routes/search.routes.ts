import { Router } from "express";
import {    
    searchMulticityController,
    searchOneWayController, 
    searchReturnController, 
} from "../controllers/search.controller";

import airportRoutes from "./airport.routes";

const router = Router();

router.use("/airports", airportRoutes);
router.post("/oneway", searchOneWayController);
router.post("/return", searchReturnController);
router.post("/multicity", searchMulticityController);


export default router;