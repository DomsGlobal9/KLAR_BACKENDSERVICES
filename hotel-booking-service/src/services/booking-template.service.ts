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

        let currentStatus = rawStatus.toLowerCase();
        if (currentStatus === 'canceled') {
            currentStatus = 'cancelled';
        } else if (currentStatus === 'held') {
            currentStatus = 'onhold';
        }

        const fileName = `hotel-${currentStatus}-${target}.template.html`;
        const templatePath = path.join(process.cwd(), 'src', 'template', fileName);

        if (!fs.existsSync(templatePath)) {
            throw new Error(`Target HTML template file not found at path: ${templatePath}`);
        }

        let html = fs.readFileSync(templatePath, 'utf8');

        // Read the local logo file and convert it into a Base64 string data URI
        const logoAbsolutePath = path.join(process.cwd(), 'src', 'assets', 'images', 'klar-travels-logo.png');
        let logoDataUri = '';
        if (fs.existsSync(logoAbsolutePath)) {
            const logoBase64 = fs.readFileSync(logoAbsolutePath, { encoding: 'base64' });
            logoDataUri = `data:image/png;base64,${logoBase64}`;
        }

        // --- EXTRACT COMPREHENSIVE PASSENGER INFORMATION DYNAMICALLY ---
        let passengerRows = '';
        let totalTravellersCount = 0;

        // Route 1: Pull out from nested tripJackRequest payload streams
        if (booking.tripJackRequest?.roomTravellerInfo) {
            booking.tripJackRequest.roomTravellerInfo.forEach((room: any, rIndex: number) => {
                if (room.travellerInfo) {
                    room.travellerInfo.forEach((pax: any, pIndex: number) => {
                        totalTravellersCount++;
                        const fullName = `${pax.ti || ''} ${pax.fN || ''} ${pax.lN || ''}`.trim().toUpperCase();
                        const paxType = String(pax.pt || 'ADULT').toUpperCase();
                        const docInfo = pax.pNum ? `Passport: ${pax.pNum}` : 'N/A';

                        passengerRows += `
                            <td>
                                <td>Room ${rIndex + 1} - Guest ${pIndex + 1}</td>
                                <td><strong>${fullName}</strong></td>
                                <td style="text-align: center;">${paxType}</td>
                                <td style="text-align: right; color: #64748B;">${docInfo}</td>
                            </tr>
                        `;
                    });
                }
            });
        }
        // Route 2: Fallback iteration path for customized cancellation flat database entries
        else if (booking.rooms?.[0]?.guests || booking.rooms?.[0]?.price) {
            const totalGuestsCount = booking.rooms[0].guests || 1;
            for (let i = 0; i < totalGuestsCount; i++) {
                totalTravellersCount++;
                const secondaryName = (i === 0) ? String(booking.guestName || 'SUDHEER GANTA').toUpperCase() : `GUEST COMPANION ${i + 1}`;
                passengerRows += `
                    <tr>
                        <td>Room 1 - Guest ${i + 1}</td>
                        <td><strong>${secondaryName}</strong></td>
                        <td style="text-align: center;">ADULT</td>
                        <td style="text-align: right; color: #64748B;">N/A</td>
                    </tr>
                `;
            }
        }

        let passengerSectionHTML = '';
        if (totalTravellersCount > 1) {
            passengerSectionHTML = `
                <div class="section-header-row">
                    <div class="section-header-title">👥 Passenger Documentation Details (${totalTravellersCount} Guests)</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Allocation</th>
                            <th>Full Passenger Name</th>
                            <th style="text-align: center;">Type Class</th>
                            <th style="text-align: right;">Travel Credentials</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${passengerRows}
                    </tbody>
                </table>
            `;
        }

        // --- FIXED: ADAPTIVE EXTRACTION LOOKUPS FOR BILLING CONTACT INFO ---
        const clientEmail = booking.guestEmail || booking.tripJackRequest?.deliveryInfo?.emails?.[0] || 'N/A';

        let clientPhone = 'N/A';
        if (booking.guestMobile) {
            clientPhone = booking.guestMobile.trim().startsWith('+91') ? booking.guestMobile : `+91 ${booking.guestMobile}`;
        } else if (booking.tripJackRequest?.deliveryInfo?.contacts?.[0]) {
            const countryCode = booking.tripJackRequest?.deliveryInfo?.code?.[0] || '';
            clientPhone = `${countryCode} ${booking.tripJackRequest.deliveryInfo.contacts[0]}`.trim();
        }

        const roomName = booking.roomType || booking.rooms?.[0]?.roomType || booking.roomName || 'Deluxe Room';
        const roomsCount = booking.rooms?.length || booking.tripJackRequest?.roomInfo?.length || 1;

        // Dynamically extract meal plan strings from all response fields
        let mealPlan = 'Room Only';
        if (booking.rooms?.[0]?.boardType && booking.rooms[0].boardType.trim() !== "") {
            mealPlan = booking.rooms[0].boardType;
        } else if (booking.tripJackRequest?.ops?.[0]?.ris?.[0]?.mb) {
            mealPlan = booking.tripJackRequest.ops[0].ris[0].mb;
        } else if (booking.tripJackRequest?.ops?.[0]?.mb) {
            mealPlan = booking.tripJackRequest.ops[0].mb;
        }
        if (!mealPlan || mealPlan.trim() === "") {
            mealPlan = "Room Only";
        }

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

        // Header context label definitions
        let metaDateLabel = 'Booked On';
        let metaDateValue = `${formatDate(booking.createdAt)}, ${formatTime(booking.createdAt)}`;

        if (rawStatus === 'CANCELLED') {
            metaDateLabel = 'Cancelled On';
            metaDateValue = `${formatDate(booking.updatedAt)}, ${formatTime(booking.updatedAt)}`;
        }

        const cancellationPenaltyVal = booking.cancelCharge !== undefined ? booking.cancelCharge : (booking.cancellationDetails?.penalties?.[0]?.amount || 0);
        const refundAmountVal = booking.totalAmount - cancellationPenaltyVal;

        let statusString = rawStatus;
        if (rawStatus === 'HELD') {
            statusString = 'ON HOLD';
        }

        // Replace all global layout token options
        html = html
            .replace(/{{logoPath}}/g, logoDataUri)
            .replace(/{{status}}/g, statusString)
            .replace(/{{metaDateLabel}}/g, metaDateLabel)
            .replace(/{{metaDateValue}}/g, metaDateValue)
            .replace(/{{passengerSectionHTML}}/g, passengerSectionHTML)
            .replace(/{{guestName}}/g, String(booking.guestName || 'Sudheer Ganta').toUpperCase())
            .replace(/{{clientEmail}}/g, clientEmail)
            .replace(/{{clientPhone}}/g, clientPhone)
            .replace(/{{hotelName}}/g, booking.hotelName || 'Selected Hotel Portfolio')
            .replace(/{{hotelAddress}}/g, booking.hotelAddress || '')
            .replace(/{{confirmationNumber}}/g, booking.confirmationNumber || 'N/A')
            .replace(/{{checkIn}}/g, formatDate(booking.checkIn))
            .replace(/{{checkOut}}/g, formatDate(booking.checkOut))
            .replace(/{{roomName}}/g, roomName)
            .replace(/{{roomsCount}}/g, roomsCount.toString())
            .replace(/{{mealPlan}}/g, mealPlan)
            .replace(/{{currencyCode}}/g, booking.currencyCode || 'INR')

            // Format numbers to 3 decimal places matching specifications
            .replace(/{{totalAmount}}/g, Number(booking.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }))
            .replace(/{{cancellationPenalty}}/g, Number(cancellationPenaltyVal).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }))
            .replace(/{{refundAmount}}/g, Number(refundAmountVal).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }))

            // Agent internal operational profiles rules mapping keys
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

    public async generatePdfBuffer(target: 'client' | 'agent', booking: any): Promise<Buffer> {
        const htmlContent = this.compileHtml(target, booking);

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();

            // FIX 1: Use 'networkidle2' instead of 'networkidle0' (or use type assertion)
            await page.setContent(htmlContent, { waitUntil: 'networkidle2' as any });
            // Alternative: await page.setContent(htmlContent, { waitUntil: 'networkidle2' });

            const pdfUint8Array = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' }
            });

            // FIX 2: Convert Uint8Array to Buffer
            const pdfBuffer = Buffer.from(pdfUint8Array);

            return pdfBuffer;
        } finally {
            await browser.close();
        }
    }
}

export const bookingTemplateService = new BookingTemplateService();