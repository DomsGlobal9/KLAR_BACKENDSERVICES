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

            // 1. Convert Logo to Base64
            // Ensure the path points to your actual logo file in src/assets/images/
            // const logoPath = path.join(__dirname, '../../assets/images/logo.png'); 
            const logoPath = path.join(__dirname, '../assets/images/klar-travels-logo.png'); 
          console.log("21 flight-confirmation-template.controller.ts logoPath:", logoPath);
            let logoBase64 = '';
            
            if (fs.existsSync(logoPath)) {
                const bitmap = fs.readFileSync(logoPath);
                logoBase64 = `data:image/png;base64,${bitmap.toString('base64')}`;
            }

            // 2. Get dynamic data
            const bookingData = await FlightBookingService.getConfirmationHtml(Array.isArray(bookingId) ? bookingId[0] : bookingId);

            // 3. FIX: Pass BOTH arguments to the template
            const html = flightBookingConfirmationTemplate(bookingData, logoBase64);

            // 4. Generate PDF
            const pdfBuffer = await generatePdfFromHtml(html);

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename=Confirmation_${bookingId}.pdf`);
            
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