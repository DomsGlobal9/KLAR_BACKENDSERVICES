import { Router } from "express";
import ReviewController from "../controllers/review.controller";

const router = Router();

router.post("/", ReviewController.review);
router.post("/verify", ReviewController.reviewVerify);

export default router;