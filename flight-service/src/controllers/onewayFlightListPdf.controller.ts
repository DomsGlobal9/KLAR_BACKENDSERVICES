import path from 'path';
import fs from 'fs/promises';
import { Request, Response } from 'express';
import { OnewayFlightListPdfService } from '../services/onewayFlightListPdf.service';

export class OnewayFlightListPdfController {

    /**
     * Generate PDF from flight data
     * POST /api/pdf/generate-flight-pdf
     */
    static async generateFlightPDF(req: Request, res: Response) {
        try {
            const { flightData, includeLogo } = req.body;

            // Validate request
            if (!flightData || !flightData.flights || !Array.isArray(flightData.flights)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid flight data. Expected { flights: [] }'
                });
            }

            if (flightData.flights.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No flight data provided to generate PDF'
                });
            }

            // Get logo if requested
            let logoBase64: string | undefined;
            if (includeLogo) {
                try {
                    const logoPath = path.join(__dirname, '../../assets/logo.png');
                    const logoBuffer = await fs.readFile(logoPath);
                    logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
                } catch (error) {
                    console.warn('Logo not found, continuing without logo');
                }
            }

            // Generate PDF
            const pdfBuffer = await OnewayFlightListPdfService.generateFlightDetailsPDF(flightData, logoBase64);

            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=flight-details.pdf');
            res.setHeader('Content-Length', pdfBuffer.length);

            // Send PDF
            return res.send(pdfBuffer);

        } catch (error: any) {
            console.error('PDF Generation Error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate PDF',
                error: error.message
            });
        }
    }

    /**
     * Generate PDF and return as base64 (for API response)
     * POST /api/pdf/generate-flight-pdf-base64
     */
    static async generateFlightPDFBase64(req: Request, res: Response) {
        try {
            const { flightData, includeLogo } = req.body;

            if (!flightData || !flightData.flights || !Array.isArray(flightData.flights)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid flight data'
                });
            }

            let logoBase64: string | undefined;
            if (includeLogo) {
                try {
                    const logoPath = path.join(__dirname, '../../assets/logo.png');
                    const logoBuffer = await fs.readFile(logoPath);
                    logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
                } catch (error) {
                    console.warn('Logo not found');
                }
            }

            const pdfBuffer = await OnewayFlightListPdfService.generateFlightDetailsPDF(flightData, logoBase64);
            const base64PDF = pdfBuffer.toString('base64');

            return res.status(200).json({
                success: true,
                data: {
                    pdfBase64: base64PDF,
                    size: pdfBuffer.length,
                    fileName: `flight-details-${Date.now()}.pdf`
                }
            });

        } catch (error: any) {
            console.error('PDF Generation Error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate PDF',
                error: error.message
            });
        }
    }

    /**
     * Generate and stream PDF for a single flight
     * POST /api/pdf/generate-single-flight-pdf
     */
    static async generateSingleFlightPDF(req: Request, res: Response) {
        try {
            const { flight } = req.body;

            if (!flight) {
                return res.status(400).json({
                    success: false,
                    message: 'Flight data is required'
                });
            }

            const flightData = { flights: [flight] };
            let logoBase64: string | undefined;

            try {
                const logoPath = path.join(__dirname, '../../assets/logo.png');
                const logoBuffer = await fs.readFile(logoPath);
                logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
            } catch (error) {
                // Logo optional
            }

            const pdfBuffer = await OnewayFlightListPdfService.generateFlightDetailsPDF(flightData, logoBase64);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=flight-${flight.flightNumber}.pdf`);
            res.send(pdfBuffer);

        } catch (error: any) {
            console.error('PDF Generation Error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to generate PDF'
            });
        }
    }
}