import { Router } from "express";
import UpdateController from "../controllers/update.controller";

const router = Router();

router.post("/", UpdateController.updateBooking);

export default router;