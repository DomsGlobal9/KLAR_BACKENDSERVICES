import { Router } from "express";
import searchRoutes from "./search.routes";
import fareRoutes from "./fare.routes";
import reviewRoutes from "./review.route";
import ancillaryRoutes from "./ancillary.routes";
import seatRoutes from "./seat.routes";

const router = Router();

router.use("/search", searchRoutes);
router.use("/fare", fareRoutes);
router.use("/review", reviewRoutes);
router.use("/ancillary", ancillaryRoutes);
router.use("/seat", seatRoutes);

export default router;