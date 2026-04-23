import { Router } from "express";
import CancellationController from "../controllers/cancellation.controller";

const router = Router();

router.post("/charges", CancellationController.getCharges);
router.post("/submit", CancellationController.submit);
router.post("/status", CancellationController.status);

export default router;