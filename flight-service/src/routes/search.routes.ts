import { Router } from "express";
import {    
    searchMulticityController,
    searchOneWayController, 
    searchReturnController, 
    reissueSearchInitController,
    reissueSearchResultController
} from "../controllers/search.controller";

const router = Router();

router.post("/oneway", searchOneWayController);
router.post("/return", searchReturnController);
router.post("/multicity", searchMulticityController);
router.post("/reissue/init", reissueSearchInitController);
router.post("/reissue/result", reissueSearchResultController);


export default router;