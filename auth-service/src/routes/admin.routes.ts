import { Router } from "express";
import {
    getPendingVerifications,
    approveVerification,
    rejectVerification,
} from "../controllers/adminVerification.controller";

const router = Router();

router.get("/pending", getPendingVerifications);
router.post("/:userId/approve", approveVerification);
router.post("/:userId/reject", rejectVerification);

export default router;
