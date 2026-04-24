import { Router } from "express";
import AncillaryController from "../controllers/ancillary.controller";

const router = Router();

router.get("/:sessionId", AncillaryController.getAncillaries);

export default router;