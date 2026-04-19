import { Router } from "express";
import FareController from "../controllers/fare.controller";

const router = Router();

router.post("/", FareController.getFares);
router.post("/multicity", FareController.getMulticityFares);
router.post("/rule", FareController.getFareRule);

export default router;