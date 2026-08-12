import { Router } from "express";
import { PassportController } from "../controllers/passport.controller";
import { validatePassportQuote } from "../middlewares/passport.validation";

const router = Router();
const passportController = new PassportController();

router.post(
  "/quote",
  validatePassportQuote,
  passportController.createPassportQuote
);

export default router;