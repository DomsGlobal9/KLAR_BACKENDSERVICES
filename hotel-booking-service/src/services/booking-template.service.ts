import fs from 'fs';
import path from 'path';

export class BookingTemplateService {
    /**
     * Reads and parses structural raw hotel booking profiles directly into dynamic HTML views
     */
    public async generateTemplate(target: 'client' | 'agent', booking: any): Promise<string> {
        const fileName = `hotel-confirmation-${target}.template.html`;
        const templatePath = path.join(__dirname, '../template', fileName);

        if (!fs.existsSync(templatePath)) {
            throw new Error(`Target dynamic text engine template not identified at: ${templatePath}`);
        }

        let html = fs.readFileSync(templatePath, 'utf8');

        // Extract contact attributes safely from nested tripJackRequest payload structure
        const clientEmail = booking.tripJackRequest?.deliveryInfo?.emails?.[0] || 'N/A';
        const clientPhone = `${booking.tripJackRequest?.deliveryInfo?.code?.[0] || ''} ${booking.tripJackRequest?.deliveryInfo?.contacts?.[0] || ''}`.trim() || 'N/A';
        
        // Extract exact checked room configuration metrics
        const roomName = booking.roomName || 'Deluxe';
        const roomsCount = booking.tripJackRequest?.roomInfo?.length || 1;
        const mealPlan = booking.tripJackRequest?.ops?.[0]?.mb || 'Room Only';

        // Format system date instances cleanly
        const formatDate = (dateString: string) => {
            if (!dateString) return 'N/A';
            return new Date(dateString).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'long', year: 'numeric'
            });
        };

        // Inject shared data mapping arrays
        html = html
            .replace(/{{status}}/g, String(booking.status || 'PENDING').toUpperCase())
            .replace(/{{guestName}}/g, String(booking.guestName || 'Valued Guest').toUpperCase())
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
            .replace(/{{totalAmount}}/g, Number(booking.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }))
            
            // Operational internal values rendered only in agent template schemas
            .replace(/{{agentId}}/g, booking.agentId || 'N/A')
            .replace(/{{provider}}/g, String(booking.provider || 'TripJack').toUpperCase())
            .replace(/{{propertyId}}/g, booking.propertyId || 'N/A')
            .replace(/{{reservationId}}/g, booking.reservationId || 'N/A')
            .replace(/{{starRating}}/g, booking.starRating?.toString() || '4')
            .replace(/{{city}}/g, booking.city || 'N/A')
            .replace(/{{netAmount}}/g, Number(booking.netAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }))
            .replace(/{{markupAmount}}/g, Number(booking.markupAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }));

        return html;
    }
}

export const bookingTemplateService = new BookingTemplateService();