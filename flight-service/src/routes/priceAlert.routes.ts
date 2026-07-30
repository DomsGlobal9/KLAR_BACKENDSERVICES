import { Router } from "express";
import { PriceAlertController } from "../controllers/priceAlert.controller";

const router = Router();

router.post("/", PriceAlertController.createOrUpdateAlert);
router.get("/", PriceAlertController.getUserAlerts);
router.delete("/:id", PriceAlertController.deleteAlert);

export default router;
