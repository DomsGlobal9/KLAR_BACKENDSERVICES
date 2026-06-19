import { Router } from "express";
import { getClientInvoicePdf, getAgentInvoicePdf } from "../controllers/invoice-pdf.controller";

const router = Router();

// Changed from query parameters to explicit path parameters (:bookingId)
router.get("/pdf/client-invoice/:bookingId", getClientInvoicePdf);
router.get("/pdf/agent-invoice/:bookingId", getAgentInvoicePdf);

export default router;