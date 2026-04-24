import { Router } from "express";
import {    
    searchMulticityController,
    searchOneWayController, 
    searchReturnController, 
} from "../controllers/search.controller";

const router = Router();

router.post("/oneway", searchOneWayController);
router.post("/return", searchReturnController);
router.post("/multicity", searchMulticityController);


export default router;