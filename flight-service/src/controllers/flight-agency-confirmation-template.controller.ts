import { Request, Response } from "express";
import fs from 'fs';
import path from 'path';
import FlightAgencyBookingService from "../services/flight-agency-confirmation-template.service";
import { flightAgencyBookingConfirmationTemplate } from "../templates/flight-agency-booking-confirmation.template";
import { generatePdfFromHtml } from "../utils/flight-confirmatoin-pdf-generator.util";

class FlightAgencyBookingController {
    async getAgencyConfirmationPdf(req: Request, res: Response) {
        try {
            const { bookingId } = req.params;

            if (!bookingId) {
                return res.status(400).json({ success: false, message: "bookingId is required" });
            }

            // 1. Fetch the full DB and Tripjack details combined
            const cleanBookingId = Array.isArray(bookingId) ? bookingId[0] : bookingId;
            const bookingData = await FlightAgencyBookingService.getAgencyConfirmationData(cleanBookingId);

            if (!bookingData) {
                return res.status(404).json({ success: false, message: "Booking data not found" });
            }

            // 2. FIXED STATUS GUARD: Protect against object naming collisions
            let currentStatus = 'UNKNOWN';
            if (typeof bookingData?.status === 'string') {
                currentStatus = bookingData.status;
            } else if (typeof bookingData?.order?.status === 'string') {
                currentStatus = bookingData.order.status;
            }

            console.log("flight-agency-confirmation-template.controller.ts currentStatus:", currentStatus);

            if (currentStatus !== "SUCCESS") {
                return res.status(400).json({
                    success: false,
                    message: `Cannot generate Agency configuration PDF. Current booking status is: ${currentStatus}. Documents are only available for SUCCESS status.`
                });
            }

            // 3. Convert Logo to Base64
            const logoPath = path.join(__dirname, '../assets/images/klar-travels-logo.png'); 
            let logoBase64 = '';
            
            if (fs.existsSync(logoPath)) {
                const bitmap = fs.readFileSync(logoPath);
                logoBase64 = `data:image/png;base64,${bitmap.toString('base64')}`;
            }

            // 4. Render HTML using the Agency Template
            const html = flightAgencyBookingConfirmationTemplate(bookingData, logoBase64);

            // 5. Generate PDF from HTML
            const pdfBuffer = await generatePdfFromHtml(html);

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename=Agency_Confirmation_${cleanBookingId}.pdf`);
            
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