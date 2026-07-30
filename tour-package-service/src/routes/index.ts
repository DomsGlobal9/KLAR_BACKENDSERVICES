import { Router } from "express";
import toursRoutes from "./tour.routes"

const router = Router();

router.use("/query", toursRoutes);

export default router;