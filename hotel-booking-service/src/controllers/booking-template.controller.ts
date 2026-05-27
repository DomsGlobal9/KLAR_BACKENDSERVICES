// import { Request, Response } from "express";
// import { bookingsService } from "../services/bookings.service";
// import { bookingTemplateService } from "../services/booking-template.service";

// export class BookingTemplateController {
//     /**
//      * Resolves the request parameter token and handles customer-facing PDF delivery stream
//      */
//     public renderClientConfirmation = async (req: Request, res: Response): Promise<void> => {
//         try {
//             const { id } = req.params;
//             const booking = await bookingsService.getBookingById(id);

//             if (!booking) {
//                 res.status(404).json({
//                     status: false,
//                     statusCode: 404,
//                     description: "No structural profile located for client document compilation parsing.",
//                     body: null
//                 });
//                 return;
//             }

//             const pdfBuffer = await bookingTemplateService.generatePdfBuffer('client', booking);
//             const statusLabel = String(booking.status || 'invoice').toLowerCase();
            
//             res.setHeader('Content-Type', 'application/pdf');
//             res.setHeader('Content-Disposition', `attachment; filename=hotel-${statusLabel}-client-${id}.pdf`);
//             res.setHeader('Content-Length', pdfBuffer.length);
            
//             res.status(200).send(pdfBuffer);
//         } catch (error: any) {
//             console.error("Client Document Parsing Fatal Exception:", error.message);
//             res.status(500).json({
//                 status: false,
//                 statusCode: 500,
//                 description: error.message || "Template conversion engine pipeline error.",
//                 body: null
//             });
//         }
//     };

//     /**
//      * Resolves the request parameter token and handles corporate internal agent ledger PDF delivery stream
//      */
//     public renderAgentConfirmation = async (req: Request, res: Response): Promise<void> => {
//         try {
//             const { id } = req.params;
//             const booking = await bookingsService.getBookingById(id);

//             if (!booking) {
//                 res.status(404).json({
//                     status: false,
//                     statusCode: 404,
//                     description: "No structural profile located for agent ledger document compilation parsing.",
//                     body: null
//                 });
//                 return;
//             }

//             const pdfBuffer = await bookingTemplateService.generatePdfBuffer('agent', booking);
//             const statusLabel = String(booking.status || 'recon').toLowerCase();
            
//             res.setHeader('Content-Type', 'application/pdf');
//             res.setHeader('Content-Disposition', `attachment; filename=hotel-${statusLabel}-agent-${id}.pdf`);
//             res.setHeader('Content-Length', pdfBuffer.length);
            
//             res.status(200).send(pdfBuffer);
//         } catch (error: any) {
//             console.error("Agent Ledger Document Parsing Fatal Exception:", error.message);
//             res.status(500).json({
//                 status: false,
//                 statusCode: 500,
//                 description: error.message || "Template conversion engine agent pipeline error.",
//                 body: null
//             });
//         }
//     };
// }

// export const bookingTemplateController = new BookingTemplateController();
































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
            res.status(500).json({
                status: false,
                statusCode: 500,
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
            res.status(500).json({
                status: false,
                statusCode: 500,
                description: error.message || "Failed to render agent template.",
                body: null
            });
        }
    };
}

export const bookingTemplateController = new BookingTemplateController();