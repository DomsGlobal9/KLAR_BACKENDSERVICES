import { Router } from "express";
import searchRoutes from "./search.routes";
import fareRoutes from "./fare.routes";
import reviewRoutes from "./review.route";
import ancillaryRoutes from "./ancillary.routes";
import seatRoutes from "./seat.routes";
import bookingRoutes from "./booking.routes";
import bookingLocalRoute from "./bookingLocal.routes";

const router = Router();

router.use("/search", searchRoutes);
router.use("/fare", fareRoutes);
router.use("/review", reviewRoutes);
router.use("/ancillary", ancillaryRoutes);
router.use("/seat", seatRoutes);
router.use("/book", bookingRoutes);
router.use("/book-local", bookingLocalRoute);

export default router;