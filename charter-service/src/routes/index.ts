import { Router } from "express";
import charterRoutes from "./charter.routes";

const router = Router();

router.use("/charter", charterRoutes);

export default router;