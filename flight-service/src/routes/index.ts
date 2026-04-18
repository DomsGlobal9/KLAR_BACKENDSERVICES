import { Router } from "express";
import searchRoutes from "./search.routes";
import fareRoutes from "./fare.routes";

const router = Router();

router.use("/search", searchRoutes);
router.use("/fare", fareRoutes);

export default router;