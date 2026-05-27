import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

export class BookingTemplateService {
    /**
     * Reads the HTML layout template file dynamically based on status and substitutes parameters
     */
    private compileHtml(target: 'client' | 'agent', booking: any): string {
        const currentStatus = String(booking.status || 'CONFIRMED').toLowerCase();
        
        // Target structural template file mapping based on system operational state
        const fileName = `hotel-${currentStatus}-${target}.template.html`;
        const templatePath = path.join(process.cwd(), 'src', 'template', fileName);

        if (!fs.existsSync(templatePath)) {
            throw new Error(`Target HTML template file not found at path: ${templatePath}`);
        }

        let html = fs.readFileSync(templatePath, 'utf8');

        // FIX: Construct absolute asset paths correctly using project root working directory
        // const logoAbsolutePath = path.join(process.cwd(), 'src', 'assets', 'images', 'klar-travels-logo.png');
        const logoAbsolutePath = path.join(process.cwd(), 'src', 'assets', 'images', 'klar-travels-logo.png');
        const logoUrl = `file://${logoAbsolutePath}`;

        // Safely extract customer context details from the nested TripJack structure
        const clientEmail = booking.tripJackRequest?.deliveryInfo?.emails?.[0] || 'N/A';
        const clientPhone = `${booking.tripJackRequest?.deliveryInfo?.code?.[0] || ''} ${booking.tripJackRequest?.deliveryInfo?.contacts?.[0] || ''}`.trim() || 'N/A';
        
        const roomName = booking.roomName || 'Deluxe';
        const roomsCount = booking.tripJackRequest?.roomInfo?.length || 1;
        const mealPlan = booking.tripJackRequest?.ops?.[0]?.mb || 'Room Only';

        const formatDate = (dateString: string) => {
            if (!dateString) return 'N/A';
            return new Date(dateString).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
        };

        const formatTime = (dateString: string) => {
            if (!dateString) return 'N/A';
            return new Date(dateString).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', hour12: true
            });
        };

        // Format timeline profiles cleanly
        const cancelledOnFormatted = `${formatDate(booking.updatedAt || booking.currentTime)}, ${formatTime(booking.updatedAt || booking.currentTime)}`;
        const bookedOnFormatted = `${formatDate(booking.createdAt)}, ${formatTime(booking.createdAt)}`;

        // Calculate explicit cancellation pricing properties
        const cancellationPenaltyVal = booking.cancelCharge !== undefined ? booking.cancelCharge : (booking.cancelChargesInfo?.applicableCharge || 0);
        const refundAmountVal = booking.cancelChargesInfo?.refundAmount !== undefined 
            ? booking.cancelChargesInfo.refundAmount 
            : (booking.totalAmount - cancellationPenaltyVal);

        // Replace template tokens
        html = html
            .replace(/{{logoPath}}/g, logoUrl)
            .replace(/{{status}}/g, currentStatus.toUpperCase())
            .replace(/{{guestName}}/g, String(booking.guestName || 'Sudheer Ganta'))
            .replace(/{{clientEmail}}/g, clientEmail)
            .replace(/{{clientPhone}}/g, clientPhone)
            .replace(/{{hotelName}}/g, booking.hotelName || 'Taj Mahal, New Delhi')
            .replace(/{{hotelAddress}}/g, booking.hotelAddress || '')
            .replace(/{{confirmationNumber}}/g, booking.confirmationNumber || 'TGP203702369688')
            .replace(/{{cancelledOn}}/g, cancelledOnFormatted)
            .replace(/{{bookedOn}}/g, bookedOnFormatted)
            .replace(/{{checkIn}}/g, formatDate(booking.checkIn))
            .replace(/{{checkOut}}/g, formatDate(booking.checkOut))
            .replace(/{{roomName}}/g, roomName)
            .replace(/{{roomsCount}}/g, roomsCount.toString())
            .replace(/{{mealPlan}}/g, mealPlan)
            .replace(/{{currencyCode}}/g, booking.currencyCode || 'INR')
            
            // Numbers formatted to 3 decimal places matching your exact spec configurations
            .replace(/{{totalAmount}}/g, Number(booking.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }))
            .replace(/{{cancellationPenalty}}/g, Number(cancellationPenaltyVal).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }))
            .replace(/{{refundAmount}}/g, Number(refundAmountVal).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }))
            
            // Agent internal specs properties
            .replace(/{{agentId}}/g, booking.agentId || 'N/A')
            .replace(/{{provider}}/g, String(booking.provider || 'tripjack').toUpperCase())
            .replace(/{{propertyId}}/g, booking.propertyId || 'N/A')
            .replace(/{{reservationId}}/g, booking.reservationId || 'N/A')
            .replace(/{{starRating}}/g, booking.starRating?.toString() || '4')
            .replace(/{{city}}/g, booking.city || 'N/A')
            .replace(/{{netAmount}}/g, Number(booking.netAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }))
            .replace(/{{markupAmount}}/g, Number(booking.markupAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }));

        return html;
    }

    /**
     * Generates a raw PDF Buffer via Puppeteer execution
     */
    public async generatePdfBuffer(target: 'client' | 'agent', booking: any): Promise<Buffer> {
        const htmlContent = this.compileHtml(target, booking);

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
        });

        try {
            const page = await browser.newPage();
            
            await page.setBypassCSP(true);
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true, 
                margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' }
            });

            return pdfBuffer;
        } finally {
            await browser.close();
        }
    }
}

export const bookingTemplateService = new BookingTemplateService();