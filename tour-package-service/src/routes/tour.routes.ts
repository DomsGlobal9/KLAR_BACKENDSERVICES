import { Router } from "express";
import { TourQueryController } from "../controllers/tour.controller";
import { validateTourQuery } from "../middlewares/tour.validation";

const router = Router();
const controller = new TourQueryController();

router.post("/submit", validateTourQuery, controller.createQuery);

export default router;