import { Request, Response } from "express";
import { bookingsService } from "../services/bookings.service";
import { bookingTemplateService } from "../services/booking-template.service";

export class BookingTemplateController {
    /**
     * Handles and downloads Client PDF layout documents
     */
    public renderClientConfirmation = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const booking = await bookingsService.getBookingById(id);
            console.log("13 booking-template.controller.ts - renderClientConfirmation - booking:", JSON.stringify(booking));

            if (!booking) {
                res.status(404).json({
                    status: false,
                    statusCode: 404,
                    description: "No booking found for the provided identifier.",
                    body: null
                });
                return;
            }

            const pdfBuffer = await bookingTemplateService.generatePdfBuffer('client', booking);
            const statusLabel = String(booking.status || 'invoice').toLowerCase();
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=hotel-${statusLabel}-client-${id}.pdf`);
            res.setHeader('Content-Length', pdfBuffer.length);
            
            res.status(200).send(pdfBuffer);
        } catch (error: any) {
            console.error("Client PDF Generation Error:", error.message);
            
            const isValidationError = error.message.includes("Invalid booking status");
            res.status(isValidationError ? 400 : 500).json({
                status: false,
                statusCode: isValidationError ? 400 : 500,
                description: error.message || "Failed to render client template.",
                body: null
            });
        }
    };

    /**
     * Handles and downloads Agent internal operational PDF matrices
     */
    public renderAgentConfirmation = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const booking = await bookingsService.getBookingById(id);

            if (!booking) {
                res.status(404).json({
                    status: false,
                    statusCode: 404,
                    description: "No booking found for the provided identifier.",
                    body: null
                });
                return;
            }

            const pdfBuffer = await bookingTemplateService.generatePdfBuffer('agent', booking);
            const statusLabel = String(booking.status || 'recon').toLowerCase();
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=hotel-${statusLabel}-agent-${id}.pdf`);
            res.setHeader('Content-Length', pdfBuffer.length);
            
            res.status(200).send(pdfBuffer);
        } catch (error: any) {
            console.error("Agent PDF Generation Error:", error.message);
            
            const isValidationError = error.message.includes("Invalid booking status");
            res.status(isValidationError ? 400 : 500).json({
                status: false,
                statusCode: isValidationError ? 400 : 500,
                description: error.message || "Failed to render agent template.",
                body: null
            });
        }
    };
}

export const bookingTemplateController = new BookingTemplateController();     