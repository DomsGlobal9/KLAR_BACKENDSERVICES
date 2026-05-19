import { Request, Response } from "express";
import fs from 'fs';
import path from 'path';
import FlightBookingService from "../services/flight-confirmation-template.service";
import { flightBookingConfirmationTemplate } from "../templates/flight-booking-confirmation.template";
import { flightClientCancellationTemplate } from "../templates/flight-client-cancellation.template"; // New
import { generatePdfFromHtml } from "../utils/flight-confirmatoin-pdf-generator.util";

class BookingController {
    async getConfirmationPdf(req: Request, res: Response) {
        try {
            const { bookingId } = req.params;

            if (!bookingId) {
                return res.status(400).json({ success: false, message: "bookingId is required" });
            }

            const cleanBookingId = Array.isArray(bookingId) ? bookingId[0] : bookingId;
            const bookingData = await FlightBookingService.getConfirmationHtml(cleanBookingId);

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

            console.log(`Processing Client Document Pipeline for ID: ${cleanBookingId} with Status: ${currentStatus}`);

            // 2. Load Base64 assets
            const logoPath = path.join(__dirname, '../assets/images/klar-travels-logo.png'); 
            let logoBase64 = '';
            if (fs.existsSync(logoPath)) {
                const bitmap = fs.readFileSync(logoPath);
                logoBase64 = `data:image/png;base64,${bitmap.toString('base64')}`;
            }

            // 3. Dynamic Structural Template Selector Switch Block
            let html = '';
            let filenamePrefix = 'Document';

            if (currentStatus === "SUCCESS") {
                html = flightBookingConfirmationTemplate(bookingData, logoBase64);
                filenamePrefix = 'Confirmation';
            } else if (currentStatus === "CANCELLED") {
                html = flightClientCancellationTemplate(bookingData, logoBase64);
                filenamePrefix = 'Cancellation';
            } else {
                return res.status(400).json({
                    success: false,
                    message: `Cannot generate PDF. Current status is ${currentStatus}. Documents are only available for SUCCESS or CANCELLED status values.`
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
                message: error.message || "Failed to process target document payload pipeline state",
            });
        }
    }
}

export default new BookingController();