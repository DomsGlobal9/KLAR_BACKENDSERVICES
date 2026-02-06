import { Router } from "express";
import {
    getPendingVerifications,
    approveVerification,
    rejectVerification,
} from "../controllers/adminVerification.controller";

const router = Router();

router.get("/admin/verifications/pending", getPendingVerifications);
router.post("/admin/verifications/:userId/approve", approveVerification);
router.post("/admin/verifications/:userId/reject", rejectVerification);

export default router;
