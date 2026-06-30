import { Router } from "express";
import { BookingPaymentController } from "../controllers/bookingPayment.controller";
import { authenticateJWT } from "../middlewares/authentication.middleware";

const router = Router();

router.get("/check-balance/:bookingId", authenticateJWT, BookingPaymentController.checkBalance);
router.post("/pay", authenticateJWT, BookingPaymentController.pay);


export default router;