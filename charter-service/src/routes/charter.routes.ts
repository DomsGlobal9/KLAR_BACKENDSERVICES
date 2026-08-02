import { Router } from "express";
import { CharterController } from "../controllers/charter.controller";
import { validateCharterQuote } from "../middlewares/charter.validation";

const router = Router();
const charterController = new CharterController();

router.post(
  "/quote",
  validateCharterQuote,
  charterController.createCharterQuote
);

export default router;