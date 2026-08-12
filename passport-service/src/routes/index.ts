import { Router } from "express";
import passportRoutes from "./passport.routes";

const router = Router();

router.use("/passport", passportRoutes);

export default router;