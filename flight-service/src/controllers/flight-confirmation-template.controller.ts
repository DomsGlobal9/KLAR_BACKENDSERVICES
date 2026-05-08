// import { Request, Response } from "express";
// import { FlightBookingService } from "../services/flight-confirmation-template.service";
// import { generatePdfFromHtml } from "../utils/flight-confirmatoin-pdf-generator.util"

// const service = new FlightBookingService();

// export const getFlightConfirmationPdf = async (req: Request, res: Response) => {
//     try {
//         const { id } = req.params;
//         const idString = Array.isArray(id) ? id[0] : id;
//         const html = await service.getConfirmationHtml(idString);
        
//         const pdfBuffer = await generatePdfFromHtml(html);
        
//         // Set headers for PDF download/viewing
//         res.setHeader('Content-Type', 'application/pdf');
//         res.setHeader('Content-Disposition', `attachment; filename=Flight_Confirmation_${id}.pdf`);
        
//         return res.status(200).send(pdfBuffer);
//     } catch (error) {
//         console.error("PDF Error:", error);
//         return res.status(500).json({ success: false, message: "Error generating PDF" });
//     }
// };





























import { Request, Response } from "express";
import BookingService from "../services/booking.service";
import { flightBookingConfirmationTemplate } from "../templates/flight-booking-confirmation.template";
import { generatePdfFromHtml } from "../utils/flight-confirmatoin-pdf-generator.util";

class BookingController {
    // ... existing methods (instantBook, confirm, etc.)

    async getConfirmationPdf(req: Request, res: Response) {
        try {
            const { bookingId } = req.params;

            if (!bookingId) {
                return res.status(400).json({ success: false, message: "bookingId is required" });
            }

            // 1. Get dynamic data from your existing service
            // This already calls Tripjack and applies the TripjackFieldMapper.map
            const bookingData = await BookingService.getBookingDetails(bookingId);

            // 2. Generate HTML string from the dynamic data
            const html = flightBookingConfirmationTemplate(bookingData);

            // 3. Convert HTML to PDF Buffer using Puppeteer
            const pdfBuffer = await generatePdfFromHtml(html);

            // 4. Send PDF as response
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