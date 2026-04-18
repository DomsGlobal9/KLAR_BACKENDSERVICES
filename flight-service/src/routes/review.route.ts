import { Router } from "express";
import ReviewController from "../controllers/review.controller";

const router = Router();

router.post("/", ReviewController.review);

export default router;