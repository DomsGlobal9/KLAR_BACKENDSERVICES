import { Request, Response } from "express";
import fs from 'fs';
import path from 'path';
import FlightBookingService from "../services/flight-confirmation-template.service";
import { flightBookingConfirmationTemplate } from "../templates/flight-booking-confirmation.template";
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

            let currentStatus = 'UNKNOWN';
            if (typeof bookingData?.status === 'string') {
                currentStatus = bookingData.status;
            } else if (typeof bookingData?.order?.status === 'string') {
                currentStatus = bookingData.order.status;
            }

            console.log("105 flight-confirmation-template.controller.ts currentStatus:", currentStatus);
            
            if (currentStatus !== "SUCCESS") {
                return res.status(400).json({
                    success: false,
                    message: `Cannot generate confirmation PDF. Current booking status is: ${currentStatus}. Documents are only available for SUCCESS status.`
                });
            }

            // 3. Convert Logo to Base64
            const logoPath = path.join(__dirname, '../assets/images/klar-travels-logo.png'); 
            let logoBase64 = '';
            
            if (fs.existsSync(logoPath)) {
                const bitmap = fs.readFileSync(logoPath);
                logoBase64 = `data:image/png;base64,${bitmap.toString('base64')}`;
            }

            // 4. Pass dynamic arguments to the template
            const html = flightBookingConfirmationTemplate(bookingData, logoBase64);

            // 5. Generate PDF
            const pdfBuffer = await generatePdfFromHtml(html);

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename=Confirmation_${cleanBookingId}.pdf`);
            
            return res.status(200).send(pdfBuffer);

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to generate PDF confirmation",
            });
        }
    }
}

export default new BookingController();