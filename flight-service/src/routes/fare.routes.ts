import { Router } from "express";
import FareController from "../controllers/fare.controller";

const router = Router();

router.post("/oneway", FareController.getFares);
router.post("/return", FareController.getReturnFares);
router.post("/multicity", FareController.getMultiCityFares);
router.post("/rule", FareController.getFareRule);

export default router;