import { Router } from "express";
import { emailController } from "../controller/email.controller";

const router = Router();

router.get("/health", emailController.healthCheck);
router.get("/status", emailController.getServiceStatus);
router.get("/queue/stats", emailController.getQueueStats);
router.get("/queue/job/:jobId", emailController.getJobStatus);

router.post("/send", emailController.sendEmail);
router.post("/send-with-attachment", emailController.sendEmail);
router.post("/send-booking-confirmation", emailController.sendBookingConfirmation);
router.post("/send-bulk", emailController.sendBulkEmails);
router.post("/send-test", emailController.sendTestEmail);
router.post("/validate", emailController.validateEmails);

export default router;