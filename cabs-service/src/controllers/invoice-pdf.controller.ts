import { Request, Response, NextFunction } from "express";
import { orderService } from "../services/order.service";
import { invoicePdfService } from "../services/invoice-pdf.service";

export const getClientInvoicePdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { bookingId } = req.params;
        const bookingData = await orderService.getBookingDetailsForInvoice(bookingId as string);

        const html = invoicePdfService.compileInvoiceHtml("client-invoice-template.html", bookingData);
        const pdfBuffer = await invoicePdfService.generatePdfBuffer(html);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename=client-invoice-${bookingId}.pdf`);
        return res.send(pdfBuffer);
    } catch (error) {
        next(error);
    }
};

export const getAgentInvoicePdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { bookingId } = req.params;
        const bookingData = await orderService.getBookingDetailsForInvoice(bookingId as string);
        
        const html = invoicePdfService.compileInvoiceHtml("agent-invoice-template.html", bookingData);
        const pdfBuffer = await invoicePdfService.generatePdfBuffer(html);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename=agent-invoice-${bookingId}.pdf`);
        return res.send(pdfBuffer);
    } catch (error) {
        next(error);
    }
};