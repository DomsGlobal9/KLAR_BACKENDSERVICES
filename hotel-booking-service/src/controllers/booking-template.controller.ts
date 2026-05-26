import { Request, Response } from "express";
import { bookingsService } from "../services/bookings.service";
import { bookingTemplateService } from "../services/booking-template.service";

export class BookingTemplateController {
    /**
     * Resolves and outputs public customer-facing invoice layouts
     */
    public renderClientConfirmation = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const booking = await bookingsService.getBookingById(id);

            if (!booking) {
                res.status(404).json({
                    status: false,
                    statusCode: 404,
                    description: "No structural booking file resolved for client target context parsing.",
                    body: null
                });
                return;
            }

            const htmlOutput = await bookingTemplateService.generateTemplate('client', booking);
            
            res.setHeader('Content-Type', 'text/html');
            res.status(200).send(htmlOutput);
        } catch (error: any) {
            console.error("Client Invoice Generation Failure Error:", error.message);
            res.status(500).json({
                status: false,
                statusCode: 500,
                description: error.message || "Template processing exception encountered during client parsing step.",
                body: null
            });
        }
    };

    /**
     * Resolves and outputs high-fidelity internal agent ledger layouts
     */
    public renderAgentConfirmation = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const booking = await bookingsService.getBookingById(id);

            if (!booking) {
                res.status(404).json({
                    status: false,
                    statusCode: 404,
                    description: "No structural booking file resolved for agent ledger context parsing.",
                    body: null
                });
                return;
            }

            const htmlOutput = await bookingTemplateService.generateTemplate('agent', booking);
            
            res.setHeader('Content-Type', 'text/html');
            res.status(200).send(htmlOutput);
        } catch (error: any) {
            console.error("Agent Ledger Generation Failure Error:", error.message);
            res.status(500).json({
                status: false,
                statusCode: 500,
                description: error.message || "Template processing exception encountered during agent parsing step.",
                body: null
            });
        }
    };
}

export const bookingTemplateController = new BookingTemplateController();