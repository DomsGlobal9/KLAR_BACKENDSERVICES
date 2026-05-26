import { Request, Response } from "express";
import { bookingsService } from "../services/bookings.service";
import { bookingTemplateService } from "../services/booking-template.service";

export class BookingTemplateController {
    public renderClientConfirmation = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const booking = await bookingsService.getBookingById(id);

            if (!booking) {
                res.status(404).json({ status: false, statusCode: 404, description: "Booking not found.", body: null });
                return;
            }

            const pdfBuffer = await bookingTemplateService.generatePdfBuffer('client', booking);
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=hotel-confirmation-client-${id}.pdf`);
            res.setHeader('Content-Length', pdfBuffer.length);
            
            res.status(200).send(pdfBuffer);
        } catch (error: any) {
            console.error("Client PDF Error:", error.message);
            res.status(500).json({ status: false, statusCode: 500, description: error.message, body: null });
        }
    };

    public renderAgentConfirmation = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const booking = await bookingsService.getBookingById(id);

            if (!booking) {
                res.status(404).json({ status: false, statusCode: 404, description: "Booking not found.", body: null });
                return;
            }

            const pdfBuffer = await bookingTemplateService.generatePdfBuffer('agent', booking);
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=hotel-confirmation-agent-${id}.pdf`);
            res.setHeader('Content-Length', pdfBuffer.length);
            
            res.status(200).send(pdfBuffer);
        } catch (error: any) {
            console.error("Agent PDF Error:", error.message);
            res.status(500).json({ status: false, statusCode: 500, description: error.message, body: null });
        }
    };
}

export const bookingTemplateController = new BookingTemplateController();