import { Request, Response } from "express";
import fs from 'fs';
import path from 'path';
import AgencyFlightBookingService from "../services/agency-flight-confirmation-template.service";
import { agencyFlightBookingConfirmationTemplate } from "../templates/agency-flight-booking-confirmation.template";
import { generatePdfFromHtml } from "../utils/flight-confirmatoin-pdf-generator.util";

class AgencyBookingController {
    async getAgencyConfirmationPdf(req: Request, res: Response) {
        try {
            const { bookingId } = req.params;

            if (!bookingId) {
                return res.status(400).json({ success: false, message: "bookingId parameters are mandatory" });
            }

            // Secure absolute runtime environment parsing for Base64 Asset streaming
            const logoPath = path.resolve(process.cwd(), 'src/assets/images/klar-travels-logo.png'); 
            let logoBase64 = '';
            
            if (fs.existsSync(logoPath)) {
                const bitmap = fs.readFileSync(logoPath);
                logoBase64 = `data:image/png;base64,${bitmap.toString('base64')}`;
            }

            // Fetch transactional entities from both sources concurrently
            const targetId = Array.isArray(bookingId) ? bookingId[0] : bookingId;
            const { tripjackData, mongoData } = await AgencyFlightBookingService.getAgencyConfirmationData(targetId);

            // Synthesize markup structure templates
            const html = agencyFlightBookingConfirmationTemplate(tripjackData, mongoData, logoBase64);

            // Stream buffer configuration to the layout output generator engine
            const pdfBuffer = await generatePdfFromHtml(html);

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename=Agency_Confirmation_${bookingId}.pdf`);
            
            return res.status(200).send(pdfBuffer);

        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to generate dynamic processing engine parameters for agency view structure layouts.",
            });
        }
    }
}

export default new AgencyBookingController();