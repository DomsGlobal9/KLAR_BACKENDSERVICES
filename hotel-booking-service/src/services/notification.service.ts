import axios from "axios";
import { IBooking } from "../models/Booking.model";

/**
 * Service to handle external notifications (Email, etc.)
 */
class NotificationService {
    private emailServiceUrl = process.env.EMAIL_SERVICE_URL || "http://localhost:5015/api/v1";

    /**
     * Send booking confirmation email via email-service
     */
    async sendBookingConfirmation(booking: IBooking) {
        try {
            console.log(`[NotificationService] Preparing confirmation for booking: ${booking.confirmationNumber}`);
            
            const recipients = new Set<string>();

            // 1. Add Registered Agent Email
            if (booking.agentName && booking.agentName.includes('@')) {
                recipients.add(booking.agentName.trim());
            }

            // 2. Extract Guest Emails from TripJack Payload
            const tjRequest = booking.tripJackRequest;
            if (tjRequest?.deliveryInfo?.emails && Array.isArray(tjRequest.deliveryInfo.emails)) {
                tjRequest.deliveryInfo.emails.forEach((email: string) => {
                    if (email && email.includes('@')) recipients.add(email.trim());
                });
            }

            // 3. Extract Guest Emails from RateGain Payload
            const rgRequest = booking.rateGainRequest;
            const rsArray = rgRequest?.BookReservation?.RoomSelection || rgRequest?.RoomSelection;
            if (Array.isArray(rsArray)) {
                rsArray.forEach((room: any) => {
                    if (Array.isArray(room.Guest)) {
                        room.Guest.forEach((guest: any) => {
                            if (guest.Email && guest.Email.includes('@')) {
                                recipients.add(guest.Email.trim());
                            }
                        });
                    }
                });
            }

            const recipientList = Array.from(recipients);

            if (recipientList.length === 0) {
                console.warn(`[NotificationService] No valid recipient emails found for booking ${booking.confirmationNumber}.`);
                return;
            }

            console.log(`[NotificationService] Sending confirmation to: ${recipientList.join(', ')}`);

            const payload = {
                to: recipientList,
                data: {
                    confirmationNumber: booking.confirmationNumber,
                    hotelName: booking.hotelName || "Hotel",
                    hotelImage: booking.hotelImage,
                    guestName: booking.guestName || "Guest",
                    checkIn: booking.checkIn.toISOString(),
                    checkOut: booking.checkOut.toISOString(),
                    totalAmount: booking.totalAmount,
                    currency: booking.currencyCode,
                    roomType: booking.roomType || (booking.rooms?.[0]?.roomType) || "Room",
                    agentName: booking.agentName
                }
            };

            const response = await axios.post(`${this.emailServiceUrl}/email/send-booking-confirmation`, payload);
            console.log(`[NotificationService] Email service response:`, response.data);
            return response.data;
        } catch (error: any) {
            console.error(`[NotificationService] Error sending booking confirmation:`, error.response?.data || error.message);
        }
    }
}

export const notificationService = new NotificationService();
