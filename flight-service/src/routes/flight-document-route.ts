import { Router } from "express";
import FlightDocumentController from "../controllers/flight-document.controller"

const router = Router();

// Add this GET route for the PDF
router.get("/document-template/:bookingId", FlightDocumentController.getDocumentPdf);

export default router;