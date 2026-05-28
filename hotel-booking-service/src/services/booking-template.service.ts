import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

export class BookingTemplateService {
    /**
     * Reads the HTML layout template file dynamically based on status and substitutes parameters
     */
    private compileHtml(target: 'client' | 'agent', booking: any): string {
        const rawStatus = String(booking.status || '').toUpperCase();

        // Strict validation whitelist: Allow only CONFIRMED, CANCELLED, or HELD statuses
        if (!['CONFIRMED', 'CANCELLED', 'HELD'].includes(rawStatus)) {
            throw new Error(`Invalid booking status: '${rawStatus}'. Templates can only be generated for CONFIRMED, CANCELLED, or HELD statuses.`);
        }

        // Normalize status strings to lowercase to map directly to your template filenames
        let currentStatus = rawStatus.toLowerCase();
        if (currentStatus === 'canceled') {
            currentStatus = 'cancelled';
        } else if (currentStatus === 'held') {
            currentStatus = 'onhold'; // Maps 'HELD' status directly to hotel-onhold-*.template.html files
        }

        const fileName = `hotel-${currentStatus}-${target}.template.html`;
        const templatePath = path.join(process.cwd(), 'src', 'template', fileName);

        if (!fs.existsSync(templatePath)) {
            throw new Error(`Target HTML template file not found at path: ${templatePath}`);
        }

        let html = fs.readFileSync(templatePath, 'utf8');

        // Read the local logo file and convert it into a Base64 string data URI for safe cross-origin rendering
        const logoAbsolutePath = path.join(process.cwd(), 'src', 'assets', 'images', 'klar-travels-logo.png');
        let logoDataUri = '';
        
        if (fs.existsSync(logoAbsolutePath)) {
            const logoBase64 = fs.readFileSync(logoAbsolutePath, { encoding: 'base64' });
            logoDataUri = `data:image/png;base64,${logoBase64}`;
        } else {
            console.error(`[Warning] Logo file not found at path: ${logoAbsolutePath}`);
        }

        // Adaptive extraction to safely fetch customer context details from all payload variants
        const clientEmail = booking.guestEmail || booking.tripJackRequest?.deliveryInfo?.emails?.[0] || 'N/A';
        
        let clientPhone = 'N/A';
        if (booking.guestMobile) {
            clientPhone = booking.guestMobile;
        } else if (booking.tripJackRequest?.deliveryInfo?.contacts?.[0]) {
            const countryCode = booking.tripJackRequest?.deliveryInfo?.code?.[0] || '';
            clientPhone = `${countryCode} ${booking.tripJackRequest.deliveryInfo.contacts[0]}`.trim();
        }
        
        const roomName = booking.roomType || booking.roomName || 'Deluxe';
        const roomsCount = booking.rooms?.length || booking.tripJackRequest?.roomInfo?.length || 1;
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

        const cancelledOnFormatted = `${formatDate(booking.updatedAt || booking.currentTime)}, ${formatTime(booking.updatedAt || booking.currentTime)}`;
        const bookedOnFormatted = `${formatDate(booking.createdAt || booking.currentTime)}, ${formatTime(booking.createdAt || booking.currentTime)}`;

        const cancellationPenaltyVal = booking.cancelCharge !== undefined ? booking.cancelCharge : (booking.cancelChargesInfo?.applicableCharge || 0);
        const refundAmountVal = booking.cancelChargesInfo?.refundAmount !== undefined 
            ? booking.cancelChargesInfo.refundAmount 
            : ((booking.totalAmount || 0) - cancellationPenaltyVal);

        // Map visible status strings back to presentation layouts cleanly
        let statusString = rawStatus;
        if (rawStatus === 'HELD') {
            statusString = 'ON HOLD';
        }

        // Replace all global template tokens
        html = html
            .replace(/{{logoPath}}/g, logoDataUri)
            .replace(/{{status}}/g, statusString)
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
            
            .replace(/{{totalAmount}}/g, Number(booking.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }))
            .replace(/{{cancellationPenalty}}/g, Number(cancellationPenaltyVal).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }))
            .replace(/{{refundAmount}}/g, Number(refundAmountVal).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }))
            
            // Agent-specific operation fields
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
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
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