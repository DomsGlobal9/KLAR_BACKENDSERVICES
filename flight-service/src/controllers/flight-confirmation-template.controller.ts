// import { Request, Response } from "express";
// import FlightBookingService from "../services/flight-confirmation-template.service";
// import { flightBookingConfirmationTemplate } from "../templates/flight-booking-confirmation.template";
// import { generatePdfFromHtml } from "../utils/flight-confirmatoin-pdf-generator.util";

// class BookingController {
//     // ... existing methods (instantBook, confirm, etc.)

//     async getConfirmationPdf(req: Request, res: Response) {
//         try {
//             const bookingIdParam = req.params.bookingId;
//             const bookingId = Array.isArray(bookingIdParam) ? bookingIdParam[0] : bookingIdParam;

//             if (!bookingId) {
//                 return res.status(400).json({ success: false, message: "bookingId is required" });
//             }

//             // 1. Get dynamic data from your existing service
//             // This already calls Tripjack and applies the TripjackFieldMapper.map
//             const bookingData = await FlightBookingService.getConfirmationHtml(bookingId);

//             // 2. Generate HTML string from the dynamic data
//             const html = flightBookingConfirmationTemplate(bookingData);

//             // 3. Convert HTML to PDF Buffer using Puppeteer
//             const pdfBuffer = await generatePdfFromHtml(html);

//             // 4. Send PDF as response
//             res.setHeader("Content-Type", "application/pdf");
//             res.setHeader("Content-Disposition", `attachment; filename=Confirmation_${bookingId}.pdf`);
            
//             return res.status(200).send(pdfBuffer);

//         } catch (error: any) {
//             return res.status(500).json({
//                 success: false,
//                 message: error.message || "Failed to generate PDF confirmation",
//             });
//         }
//     }
// }

// export default new BookingController();



















import { Request, Response } from "express";
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

            // 1. Get Dynamic Data (Mmapped Tripjack response)
            const bookingData = await FlightBookingService.getConfirmationHtml(Array.isArray(bookingId) ? bookingId[0] : bookingId);

            if (!bookingData) {
                return res.status(404).json({ success: false, message: "No booking found" });
            }

            // 2. Generate HTML with Dynamic Data
            const html = flightBookingConfirmationTemplate(bookingData);

            // 3. Generate PDF Buffer
            const pdfBuffer = await generatePdfFromHtml(html);

            // 4. Send PDF Response
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename=Confirmation_${bookingId}.pdf`);
            
            return res.status(200).send(pdfBuffer);

        } catch (error: any) {
            console.error("PDF generation failed:", error.message);
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to generate PDF confirmation",
            });
        }
    }
}

export default new BookingController();