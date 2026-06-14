import { Router } from 'express';
import { OnewayFlightListPdfController } from '../controllers/onewayFlightListPdf.controller';


const router = Router();

/**
 * Generate PDF from flight data (download as file)
 */
router.post('/generate-flight-pdf', OnewayFlightListPdfController.generateFlightPDF);

/**
 * Generate PDF and return as base64 (for API response)
 */
router.post('/generate-flight-pdf-base64', OnewayFlightListPdfController.generateFlightPDFBase64);

/**
 * Generate PDF for single flight
 */
router.post('/generate-single-flight-pdf', OnewayFlightListPdfController.generateSingleFlightPDF);

export default router;