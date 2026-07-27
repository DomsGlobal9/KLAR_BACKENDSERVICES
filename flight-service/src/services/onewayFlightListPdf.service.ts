import path from 'path';
import fs from 'fs/promises';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import { onewayFlightListPdfTemplate } from '../templates/onewayFlightListPdf.template';
import { registerHandlebarsHelpers } from '../utils/helper/handlebars.helpers';

export class OnewayFlightListPdfService {

    /**
     * Generate PDF from HTML template
     */
    static async generatePDF(htmlContent: string, options?: {
        format?: 'A4' | 'Letter' | 'Legal';
        landscape?: boolean;
        margin?: { top?: string; right?: string; bottom?: string; left?: string };
    }): Promise<Buffer> {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();

            await page.setContent(htmlContent, {
                waitUntil: 'load'
            });

            const pdfBuffer = await page.pdf({
                format: options?.format || 'A4',
                landscape: options?.landscape || false,
                margin: options?.margin || {
                    top: '20px',
                    right: '20px',
                    bottom: '20px',
                    left: '20px'
                },
                printBackground: true,
                preferCSSPageSize: true
            });

            return Buffer.from(pdfBuffer);
        } finally {
            await browser.close();
        }
    }

    /**
     * Generate flight details PDF
     */
    static async generateFlightDetailsPDF(flightData: any, logoBase64?: string): Promise<Buffer> {
        registerHandlebarsHelpers();
        const compiledTemplate = Handlebars.compile(onewayFlightListPdfTemplate);

        if (!logoBase64) {
            try {
                const logoPath = path.join(__dirname, '../assets/images/klar-travels-logo.png');
                const logoBuffer = await fs.readFile(logoPath);
                logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
            } catch (error) {

            }
        }

        
        const flights = flightData.flights || [];
        const prices = flights.map((f: any) => f.cheapestFare?.price || 0);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

        
        const templateData = {
            flights: flights,
            totalFlights: flights.length,
            generatedDate: new Date().toLocaleString('en-IN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }),
            logoBase64: logoBase64 || '',
            minPrice: minPrice,
            maxPrice: maxPrice,
            uniqueAirlines: new Set(flights.map((f: any) => f.airline)).size,
            searchParams: flightData.searchParams,
            filtersApplied: flightData.filtersApplied,
            sortApplied: flightData.sortApplied
        };

        const htmlContent = compiledTemplate(templateData);

        return await this.generatePDF(htmlContent, {
            format: 'A4',
            landscape: false,
            margin: { top: '15px', right: '15px', bottom: '15px', left: '15px' }
        });
    }
}