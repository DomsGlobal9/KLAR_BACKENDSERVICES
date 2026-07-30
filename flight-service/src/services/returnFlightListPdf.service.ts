import path from 'path';
import fs from 'fs/promises';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import { registerHandlebarsHelpers } from '../utils/helper/handlebars.helpers';
import { returnFlightListPdfTemplate } from '../templates/returnFlightListPdf.template';


export class ReturnFlightListPdfService {

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
                landscape: options?.landscape || true,
                margin: options?.margin || {
                    top: '10px',
                    right: '10px',
                    bottom: '10px',
                    left: '10px'
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
     * Generate return flight details PDF
     */
    static async generateReturnFlightDetailsPDF(flightData: any, logoBase64?: string): Promise<Buffer> {
        
        registerHandlebarsHelpers();

        
        const compiledTemplate = Handlebars.compile(returnFlightListPdfTemplate);

        
        if (!logoBase64) {
            try {
                const logoPath = path.join(__dirname, '../assets/images/klar-travels-logo.png');
                const logoBuffer = await fs.readFile(logoPath);
                logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
            } catch (error) {

            }
        }

        
        let processedData: any = {
            type: flightData.type,
            searchParams: flightData.searchParams,
            generatedDate: new Date().toLocaleString('en-IN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }),
            logoBase64: logoBase64 || ''
        };

        if (flightData.type === 'domestic') {
            
            const onward = flightData.onward || [];
            const returnFlights = flightData.return || [];

            
            const onwardPrices = onward.map((f: any) => f.cheapestFare?.price || 0);
            const returnPrices = returnFlights.map((f: any) => f.cheapestFare?.price || 0);
            const allPrices = [...onwardPrices, ...returnPrices];

            processedData = {
                ...processedData,
                onward,
                return: returnFlights,
                totalOnward: onward.length,
                totalReturn: returnFlights.length,
                totalFlights: onward.length + returnFlights.length,
                minPrice: allPrices.length > 0 ? Math.min(...allPrices) : 0,
                maxPrice: allPrices.length > 0 ? Math.max(...allPrices) : 0,
                uniqueAirlines: new Set([...onward, ...returnFlights].map((f: any) => f.airline)).size
            };
        }
        else if (flightData.type === 'international') {
            const roundTrips = flightData.roundTrips || [];

            const prices = roundTrips.map((rt: any) => rt.totalPrice || 0);

            processedData = {
                ...processedData,
                roundTrips,
                totalRoundTrips: roundTrips.length,
                minPrice: prices.length > 0 ? Math.min(...prices) : 0,
                maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
                uniqueAirlines: new Set(
                    roundTrips.flatMap((rt: any) => [rt.onward?.airline, rt.return?.airline]).filter(Boolean)
                ).size
            };
        }

        const htmlContent = compiledTemplate(processedData);

        return await this.generatePDF(htmlContent, {
            format: 'A4',
            landscape: true,
            margin: { top: '10px', right: '10px', bottom: '10px', left: '10px' }
        });
    }
}