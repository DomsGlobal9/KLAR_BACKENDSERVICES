import { Router } from "express";
import searchRoutes from "./search.routes";
import fareRoutes from "./fare.routes";
import reviewRoutes from "./review.route";
import ancillaryRoutes from "./ancillary.routes";

const router = Router();

router.use("/search", searchRoutes);
router.use("/fare", fareRoutes);
router.use("/review", reviewRoutes);
router.use("/ancillary", ancillaryRoutes);

export default router;