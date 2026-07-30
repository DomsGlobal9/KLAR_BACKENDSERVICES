import path from 'path';
import fs from 'fs/promises';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import { multicityFlightListPdfTemplate } from '../templates/multicityFlightListPdf.template';
import { registerHandlebarsHelpers } from '../utils/helper/handlebars.helpers';

export class MultiCityFlightListPdfService {

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
     * Generate multicity flight details PDF
     */
    static async generateMultiCityFlightDetailsPDF(flightData: any, logoBase64?: string): Promise<Buffer> {
        
        registerHandlebarsHelpers();

        
        const compiledTemplate = Handlebars.compile(multicityFlightListPdfTemplate);

        
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

            const legs = flightData.legs || [];


            let totalFlights = 0;
            const legStats = legs.map((leg: any) => {
                const flightCount = leg.flights?.length || 0;
                totalFlights += flightCount;
                return {
                    legIndex: leg.legIndex,
                    flightCount: flightCount
                };
            });


            let allPrices: number[] = [];
            legs.forEach((leg: any) => {
                if (leg.flights) {
                    leg.flights.forEach((flight: any) => {
                        if (flight.cheapestFare?.price) {
                            allPrices.push(flight.cheapestFare.price);
                        }
                    });
                }
            });

            processedData = {
                ...processedData,
                legs,
                legStats,
                totalFlights,
                minPrice: allPrices.length > 0 ? Math.min(...allPrices) : 0,
                maxPrice: allPrices.length > 0 ? Math.max(...allPrices) : 0,
                totalLegs: legs.length
            };
        }
        else if (flightData.type === 'international') {

            const itineraries = flightData.itineraries || [];


            const prices = itineraries.map((it: any) => it.totalPrice || 0);
            const uniqueAirlines = new Set();

            itineraries.forEach((it: any) => {
                if (it.legs) {
                    it.legs.forEach((leg: any) => {
                        if (leg.airline) uniqueAirlines.add(leg.airline);
                    });
                }
            });

            processedData = {
                ...processedData,
                itineraries,
                totalItineraries: itineraries.length,
                minPrice: prices.length > 0 ? Math.min(...prices) : 0,
                maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
                uniqueAirlines: uniqueAirlines.size
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