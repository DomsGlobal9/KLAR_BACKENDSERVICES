import { Request, Response } from "express";
import fs from 'fs';
import path from 'path';
import FlightAgencyBookingService from "../services/flight-agency-confirmation-template.service";
import { flightAgencyBookingConfirmationTemplate } from "../templates/flight-agency-booking-confirmation.template";
import { generatePdfFromHtml } from "../utils/flight-confirmatoin-pdf-generator.util"; // Reusing your high-quality Puppeteer generator

class FlightAgencyBookingController {
    async getAgencyConfirmationPdf(req: Request, res: Response) {
        try {
            const { bookingId } = req.params;

            if (!bookingId) {
                return res.status(400).json({ success: false, message: "bookingId is required" });
            }

            // 1. Convert Logo to Base64
            const logoPath = path.join(__dirname, '../assets/images/klar-travels-logo.png'); 
            console.log("flight-agency-confirmation-template.controller.ts logoPath:", logoPath);
            let logoBase64 = '';
            
            if (fs.existsSync(logoPath)) {
                const bitmap = fs.readFileSync(logoPath);
                logoBase64 = `data:image/png;base64,${bitmap.toString('base64')}`;
            }

            // 2. Get the full DB and Tripjack details combined
            const bookingData = await FlightAgencyBookingService.getAgencyConfirmationData(
                Array.isArray(bookingId) ? bookingId[0] : bookingId
            );

            if (!bookingData) {
                return res.status(404).json({ success: false, message: "Booking data not found" });
            }

            // 3. Render HTML using the explicit Agency Template
            const html = flightAgencyBookingConfirmationTemplate(bookingData, logoBase64);

            // 4. Generate PDF from HTML
            const pdfBuffer = await generatePdfFromHtml(html);

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename=Agency_Confirmation_${bookingId}.pdf`);
            
            return res.status(200).send(pdfBuffer);

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to generate Agency PDF confirmation",
            });
        }
    }
}

export default new FlightAgencyBookingController();