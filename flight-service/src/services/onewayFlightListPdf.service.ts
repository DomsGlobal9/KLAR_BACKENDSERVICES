import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';

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
        const template = this.getFlightDetailsTemplate();
        const compiledTemplate = Handlebars.compile(template);

        /**
         * Register Handlebars helpers
         */
        Handlebars.registerHelper('formatCurrency', (value: number) => {
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(value);
        });

        Handlebars.registerHelper('formatTime', (time: string) => {
            return time;
        });

        Handlebars.registerHelper('formatDate', (date: string) => {
            return date;
        });

        Handlebars.registerHelper('eq', (a: any, b: any) => a === b);

        Handlebars.registerHelper('times', (n: number, block: any) => {
            let accum = '';
            for (let i = 0; i < n; ++i)
                accum += block.fn(i);
            return accum;
        });

        /**
         * Calculate min and max prices
         */
        const flights = flightData.flights || [];
        const prices = flights.map((f: any) => f.cheapestFare?.price || 0);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

        const htmlContent = compiledTemplate({
            flights: flights,
            totalFlights: flights.length,
            generatedDate: new Date().toLocaleString(),
            logoBase64: logoBase64 || '',
            minPrice: minPrice,
            maxPrice: maxPrice,
            uniqueAirlines: new Set(flights.map((f: any) => f.airline)).size
        });

        return await this.generatePDF(htmlContent, {
            format: 'A4',
            landscape: false,
            margin: { top: '15px', right: '15px', bottom: '15px', left: '15px' }
        });
    }

    /**
     * Get flight details HTML template
     */
    private static getFlightDetailsTemplate(): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Flight Details Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            background: white;
            color: #1e293b;
            font-size: 12px;
            line-height: 1.4;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        /* Header */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e2e8f0;
        }
        
        .logo {
            max-height: 60px;
        }
        
        .report-title {
            text-align: right;
        }
        
        .report-title h1 {
            font-size: 20px;
            color: #0f172a;
            margin-bottom: 5px;
        }
        
        .report-title .date {
            font-size: 10px;
            color: #64748b;
        }
        
        /* Summary Cards */
        .summary {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 30px;
        }
        
        .summary-card {
            background: #f8fafc;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            border: 1px solid #e2e8f0;
        }
        
        .summary-card .label {
            font-size: 10px;
            font-weight: 600;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        
        .summary-card .value {
            font-size: 24px;
            font-weight: 700;
            color: #0f172a;
        }
        
        /* Flight Card */
        .flight-card {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            margin-bottom: 20px;
            overflow: hidden;
            break-inside: avoid;
            page-break-inside: avoid;
        }
        
        .flight-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .airline-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .airline-name {
            font-size: 16px;
            font-weight: 700;
        }
        
        .flight-number {
            font-size: 12px;
            opacity: 0.9;
        }
        
        .stops-badge {
            background: rgba(255,255,255,0.2);
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
        }
        
        /* Route Section */
        .route-section {
            padding: 20px;
            background: #fafbff;
        }
        
        .route {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .airport {
            flex: 1;
        }
        
        .airport.departure {
            text-align: left;
        }
        
        .airport.arrival {
            text-align: right;
        }
        
        .airport-code {
            font-size: 24px;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 5px;
        }
        
        .airport-city {
            font-size: 12px;
            color: #475569;
            margin-bottom: 5px;
        }
        
        .airport-name {
            font-size: 10px;
            color: #64748b;
        }
        
        .time {
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            margin: 8px 0 4px;
        }
        
        .date {
            font-size: 10px;
            color: #64748b;
        }
        
        .journey-line {
            flex: 0 0 150px;
            text-align: center;
            position: relative;
        }
        
        .duration {
            font-size: 11px;
            font-weight: 600;
            color: #475569;
            margin-top: 8px;
        }
        
        .plane-icon {
            font-size: 20px;
            color: #667eea;
        }
        
        /* Fare Details */
        .fare-details {
            padding: 20px;
            border-top: 1px solid #e2e8f0;
            background: white;
        }
        
        .fare-title {
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }
        
        .fare-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
        }
        
        .fare-table th {
            background: #f1f5f9;
            padding: 8px 10px;
            text-align: left;
            font-weight: 600;
            color: #475569;
            border: 1px solid #e2e8f0;
        }
        
        .fare-table td {
            padding: 8px 10px;
            border: 1px solid #e2e8f0;
            color: #1e293b;
        }
        
        .fare-table .fare-name {
            font-weight: 600;
            color: #0f172a;
        }
        
        .fare-table .price {
            font-weight: 700;
            color: #10b981;
        }
        
        .cheapest-badge {
            background: #10b981;
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 600;
            margin-left: 8px;
        }
        
        /* Footer */
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 9px;
            color: #94a3b8;
        }
        
        @media print {
            body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
            
            .flight-card {
                break-inside: avoid;
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            {{#if logoBase64}}
                <img src="{{logoBase64}}" class="logo" alt="Logo">
            {{else}}
                <div class="logo" style="font-size: 20px; font-weight: 800; color: #667eea;">FLIGHT SEARCH</div>
            {{/if}}
            <div class="report-title">
                <h1>Flight Details Report</h1>
                <div class="date">Generated: {{generatedDate}}</div>
            </div>
        </div>
        
        <!-- Summary -->
        <div class="summary">
            <div class="summary-card">
                <div class="label">Total Flights Found</div>
                <div class="value">{{totalFlights}}</div>
            </div>
            <div class="summary-card">
                <div class="label">Airlines</div>
                <div class="value">{{uniqueAirlines}}</div>
            </div>
            <div class="summary-card">
                <div class="label">Price Range</div>
                <div class="value">₹{{minPrice}} - ₹{{maxPrice}}</div>
            </div>
        </div>
        
        <!-- Flight Cards -->
        {{#each flights}}
        <div class="flight-card">
            <div class="flight-header">
                <div class="airline-info">
                    <div class="airline-name">{{this.airline}}</div>
                    <div class="flight-number">{{this.flightNumber}}</div>
                </div>
                <div class="stops-badge">
                    {{#if (eq this.stops 0)}}NON-STOP{{/if}}
                    {{#if (eq this.stops 1)}}1 STOP{{/if}}
                    {{#if (eq this.stops 2)}}2 STOPS{{/if}}
                </div>
            </div>
            
            <div class="route-section">
                <div class="route">
                    <div class="airport departure">
                        <div class="airport-code">{{this.from.airportCode}}</div>
                        <div class="airport-city">{{this.from.city}}</div>
                        <div class="airport-name">{{this.from.airportName}}</div>
                        <div class="time">{{this.from.time}}</div>
                        <div class="date">{{this.from.date}} • {{this.from.day}}</div>
                    </div>
                    
                    <div class="journey-line">
                        <div class="plane-icon">✈</div>
                        <div class="duration">{{this.duration}}</div>
                    </div>
                    
                    <div class="airport arrival">
                        <div class="airport-code">{{this.to.airportCode}}</div>
                        <div class="airport-city">{{this.to.city}}</div>
                        <div class="airport-name">{{this.to.airportName}}</div>
                        <div class="time">{{this.to.time}}</div>
                        <div class="date">{{this.to.date}} • {{this.to.day}}</div>
                    </div>
                </div>
            </div>
            
            <div class="fare-details">
                <div class="fare-title">
                    💰 Fare Options
                    <span class="cheapest-badge">Cheapest: {{formatCurrency this.cheapestFare.price}}</span>
                </div>
                
                <table class="fare-table">
                    <thead>
                        <tr>
                            <th>Fare Name</th>
                            <th>Cabin Class</th>
                            <th>Base Fare</th>
                            <th>Tax</th>
                            <th>Total Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        {{#each this.allFares}}
                        <tr {{#if (eq this.totalPrice ../cheapestFare.price)}}style="background: #f0fdf4;"{{/if}}>
                            <td class="fare-name">{{this.fareName}}</td>
                            <td>{{this.cabinClass}}</td>
                            <td>₹{{formatNumber this.baseFare}}</td>
                            <td>₹{{formatNumber this.tax}}</td>
                            <td class="price">₹{{formatNumber this.totalPrice}}</td>
                        </tr>
                        {{/each}}
                    </tbody>
                </table>
                
                <div style="margin-top: 10px; font-size: 10px; color: #64748b;">
                    Fare Summary: {{this.fareSummary.totalFares}} options available
                    (Range: {{formatCurrency this.fareSummary.priceRange.min}} - {{formatCurrency this.fareSummary.priceRange.max}})
                </div>
            </div>
        </div>
        {{/each}}
        
        <!-- Footer -->
        <div class="footer">
            <p>This is a system-generated report. For booking assistance, please contact support.</p>
            <p>© {{currentYear}} Flight Search Platform. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `;
    }
}

/**
 * Helper function to format numbers
 */
function formatNumber(num: number): string {
    if (!num && num !== 0) return '0';
    return num.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

/**
 * Register helpers globally
 */
Handlebars.registerHelper('formatNumber', formatNumber);
Handlebars.registerHelper('formatCurrency', (value: number) => {
    if (!value && value !== 0) return '₹0';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
});

Handlebars.registerHelper('currentYear', () => new Date().getFullYear());

Handlebars.registerHelper('eq', (a: any, b: any) => a === b);