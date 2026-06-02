import axios from "axios";
import { ICabBooking } from "../models/CabBooking.model";
import { generateCabVoucherHTML } from "../templates/cabConfirmationTemplate";

/**
 * Service to handle external notifications (Email, etc.)
 */
class NotificationService {
    private emailServiceUrl = process.env.EMAIL_SERVICE_URL || "http://localhost:5015/api/v1";

    /**
     * Send cab booking confirmation email via email-service
     */
    async sendBookingConfirmation(booking: ICabBooking) {
        try {
            console.log(`[NotificationService] Preparing confirmation for booking: ${booking.bookingId}`);
            
            const recipients = new Set<string>();

            // 1. Add Registered Agent Email
            const tjRequest = booking.tripJackRequest;
            if (tjRequest?.agentEmail && tjRequest.agentEmail.includes('@')) {
                recipients.add(tjRequest.agentEmail.trim());
            }

            // 2. Extract Guest Emails from Booking Request
            if (booking.passenger?.email && booking.passenger.email.includes('@')) {
                recipients.add(booking.passenger.email.trim());
            }

            const recipientList = Array.from(recipients);

            if (recipientList.length === 0) {
                console.warn(`[NotificationService] No valid recipient emails found for booking ${booking.bookingId}.`);
                return;
            }

            console.log(`[NotificationService] Sending confirmation to: ${recipientList.join(', ')}`);

            const htmlContent = generateCabVoucherHTML(booking);

            const payload = {
                to: recipientList,
                subject: `Cab Booking Confirmation - ${booking.bookingId}`,
                html: htmlContent
            };

            const response = await axios.post(`${this.emailServiceUrl}/email/send`, payload);
            console.log(`[NotificationService] Email service response:`, response.data);
            return response.data;
        } catch (error: any) {
            console.error(`[NotificationService] Error sending booking confirmation:`, error.response?.data || error.message);
        }
    }
}

export const notificationService = new NotificationService();
