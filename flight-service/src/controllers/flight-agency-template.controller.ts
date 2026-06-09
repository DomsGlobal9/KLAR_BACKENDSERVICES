import { Request, Response } from "express";
import fs from 'fs';
import path from 'path';
import FlightAgencyBookingService from "../services/flight-agency-template.service";
import { flightAgencyBookingConfirmationTemplate } from "../templates/flight-agency-booking-confirmation.template";
import { flightAgencyCancellationTemplate } from "../templates/flight-agency-cancellation.template"; // New
import { generatePdfFromHtml } from "../utils/flight-document-pdf-generator.util";

class FlightAgencyBookingController {
    async getAgencyPdf(req: Request, res: Response) {
        try {
            const { bookingId } = req.params;

            if (!bookingId) {
                return res.status(400).json({ success: false, message: "bookingId is required" });
            }

            const cleanBookingId = Array.isArray(bookingId) ? bookingId[0] : bookingId;
            const bookingData = await FlightAgencyBookingService.getAgencyData(cleanBookingId);

            if (!bookingData) {
                return res.status(404).json({ success: false, message: "Booking data not found" });
            }

            // 1. Resolve State Status Engine Mapping cleanly
            let currentStatus = 'UNKNOWN';
            if (typeof bookingData?.status === 'string') {
                currentStatus = bookingData.status.toUpperCase();
            } else if (typeof bookingData?.order?.status === 'string') {
                currentStatus = bookingData.order.status.toUpperCase();
            }

            console.log(`Processing Agency Accounting Pipeline for ID: ${cleanBookingId} with Status: ${currentStatus}`);

            // 2. Load Base64 assets
            const logoPath = path.join(__dirname, '../assets/images/klar-travels-logo.png'); 
            let logoBase64 = '';
            if (fs.existsSync(logoPath)) {
                const bitmap = fs.readFileSync(logoPath);
                logoBase64 = `data:image/png;base64,${bitmap.toString('base64')}`;
            }

            // 3. Dynamic Structural Template Selector Switch Block
            let html = '';
            let filenamePrefix = 'Agency_Document';

            if (currentStatus === "SUCCESS") {
                html = flightAgencyBookingConfirmationTemplate(bookingData, logoBase64);
                filenamePrefix = 'Agency_Booking';
            } else if (currentStatus === "CANCELLED") {
                html = flightAgencyCancellationTemplate(bookingData, logoBase64);
                filenamePrefix = 'Agency_Cancellation';
            } else {
                return res.status(400).json({
                    success: false,
                    message: `Cannot generate Agency PDF. Current status is ${currentStatus}. Documents are only available for SUCCESS or CANCELLED status values.`
                });
            }

            // 4. Generate and send PDF Binary data stream
            const pdfBuffer = await generatePdfFromHtml(html);

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename=${filenamePrefix}_${cleanBookingId}.pdf`);
            
            return res.status(200).send(pdfBuffer);

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to process target agency document compilation",
            });
        }
    }
}

export default new FlightAgencyBookingController();