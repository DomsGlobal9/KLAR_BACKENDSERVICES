import { Router } from "express";
import SeatController from "../controllers/seat.controller";

const router = Router();

router.post("/", SeatController.getSeats);


export default router;