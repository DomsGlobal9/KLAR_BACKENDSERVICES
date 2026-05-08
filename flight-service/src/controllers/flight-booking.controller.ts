import { Request, Response } from "express";
import { FlightBookingService } from "../services/flight-booking.service";
import { generatePdfFromHtml } from "../utils/flight-confirmatoin-pdf-generator.util"

const service = new FlightBookingService();

export const getFlightConfirmationPdf = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const idString = Array.isArray(id) ? id[0] : id;
        const html = await service.getConfirmationHtml(idString);
        
        const pdfBuffer = await generatePdfFromHtml(html);
        
        // Set headers for PDF download/viewing
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Flight_Confirmation_${id}.pdf`);
        
        return res.status(200).send(pdfBuffer);
    } catch (error) {
        console.error("PDF Error:", error);
        return res.status(500).json({ success: false, message: "Error generating PDF" });
    }
};