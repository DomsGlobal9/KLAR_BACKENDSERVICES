import axios from "axios";
import { IBooking } from "../models/Booking.model";
import { compileReactHtml } from "../templates/HotelEmailTemplates";
import { pdfGeneratorService } from "./hotel-pdf.service";

/**
 * Service to handle external notifications (Email, etc.)
 */
class NotificationService {
  private emailServiceUrl =
    process.env.EMAIL_SERVICE_URL || "http://localhost:5015/api/v1";

  /**
   * Send booking confirmation email via email-service
   */
  async sendBookingConfirmation(booking: IBooking) {
    return this.sendBookingStatusEmail(booking, "CONFIRMED");
  }

  /**
   * Send booking status update email to guest (and/or agent)
   */
  async sendBookingStatusEmail(booking: IBooking, status: string) {
    try {
      const rawStatus = String(status || "").toUpperCase();
      console.log(
        `[NotificationService] Preparing ${rawStatus} email for booking: ${booking.confirmationNumber}`,
      );

      const guestRecipients = new Set<string>();
      const agentRecipients = new Set<string>();

      // 1. Extract Guest Emails from booking guest fields
      if (booking.guestEmail && booking.guestEmail.includes("@")) {
        guestRecipients.add(booking.guestEmail.trim());
      }

      // 2. Extract Guest Emails from TripJack Payload
      const tjRequest = booking.tripJackRequest;
      if (
        tjRequest?.deliveryInfo?.emails &&
        Array.isArray(tjRequest.deliveryInfo.emails)
      ) {
        tjRequest.deliveryInfo.emails.forEach((email: string) => {
          if (email && email.includes("@")) guestRecipients.add(email.trim());
        });
      }

      // 3. Extract Guest Emails from RateGain Payload
      const rgRequest = booking.rateGainRequest;
      const rsArray =
        rgRequest?.BookReservation?.RoomSelection || rgRequest?.RoomSelection;
      if (Array.isArray(rsArray)) {
        rsArray.forEach((room: any) => {
          if (Array.isArray(room.Guest)) {
            room.Guest.forEach((guest: any) => {
              if (guest.Email && guest.Email.includes("@")) {
                guestRecipients.add(guest.Email.trim());
              }
            });
          }
        });
      }

      // 4. Split Agent vs Client
      if (booking.clientType === "B2B") {
        if (booking.agentName && booking.agentName.includes("@")) {
          agentRecipients.add(booking.agentName.trim());
        }
        if (booking.userInfo?.email && booking.userInfo.email.includes("@")) {
          agentRecipients.add(booking.userInfo.email.trim());
        }
        // Exclude agent from guest list to prevent duplication
        agentRecipients.forEach((email) => guestRecipients.delete(email));
      } else {
        if (booking.agentName && booking.agentName.includes("@")) {
          guestRecipients.add(booking.agentName.trim());
        }
        if (booking.userInfo?.email && booking.userInfo.email.includes("@")) {
          guestRecipients.add(booking.userInfo.email.trim());
        }
      }

      const guestList = Array.from(guestRecipients);
      const agentList = Array.from(agentRecipients);

      if (guestList.length === 0 && agentList.length === 0) {
        console.warn(
          `[NotificationService] No valid recipient emails found for booking ${booking.confirmationNumber}.`,
        );
        return;
      }

      let subject = `Hotel Booking Update - ${booking.hotelName || "Your Stay"} (Ref: ${booking.confirmationNumber})`;
      if (rawStatus === "CONFIRMED") {
        subject = `Hotel Booking Confirmed - ${booking.hotelName || "Your Stay"} (Ref: ${booking.confirmationNumber})`;
      } else if (
        rawStatus === "CANCELLED" ||
        rawStatus === "CANCELLATION_PENDING"
      ) {
        subject = `Hotel Booking Cancelled - ${booking.hotelName || "Your Stay"} (Ref: ${booking.confirmationNumber})`;
      } else if (
        rawStatus === "PENDING" ||
        rawStatus === "SUPPLIER_PENDING" ||
        rawStatus === "MANUAL_REVIEW"
      ) {
        subject = `Hotel Booking Under Process - ${booking.hotelName || "Your Stay"} (Ref: ${booking.confirmationNumber})`;
      } else if (rawStatus === "FAILED") {
        subject = `Hotel Booking Failed & Refund Initiated - ${booking.hotelName || "Your Stay"} (Ref: ${booking.confirmationNumber})`;
      } else if (rawStatus === "HELD") {
        subject = `Hotel Booking On Hold - ${booking.hotelName || "Your Stay"} (Ref: ${booking.confirmationNumber})`;
      }

      // Send to Guests (Client copy)
      if (guestList.length > 0) {
        console.log(
          `[NotificationService] Sending client template to: ${guestList.join(", ")}`,
        );
        const htmlContent = compileReactHtml("client", booking, status);
        const pdfBuffer = await pdfGeneratorService.generateHotelVoucher(
          booking,
          "client",
          status,
        );

        const payload = {
          to: guestList,
          subject,
          html: htmlContent,
          attachments: [
            {
              filename: `hotel-voucher-${booking.confirmationNumber}.pdf`,
              content: pdfBuffer.toString("base64"),
              contentType: "application/pdf",
              encoding: "base64",
            },
          ],
        };

        const response = await axios.post(
          `${this.emailServiceUrl}/email/send-with-attachment`,
          payload,
        );
        console.log(
          `[NotificationService] Email service response (Client Copy):`,
          response.data,
        );
      }

      // Send to Agent (Agent copy)
      if (agentList.length > 0) {
        console.log(
          `[NotificationService] Sending agent template to: ${agentList.join(", ")}`,
        );
        const htmlContent = compileReactHtml("agent", booking, status);
        const pdfBuffer = await pdfGeneratorService.generateHotelVoucher(
          booking,
          "agent",
          status,
        );

        const payload = {
          to: agentList,
          subject: `${subject} (Agent Copy)`,
          html: htmlContent,
          attachments: [
            {
              filename: `hotel-voucher-${booking.confirmationNumber}.pdf`,
              content: pdfBuffer.toString("base64"),
              contentType: "application/pdf",
              encoding: "base64",
            },
          ],
        };

        const response = await axios.post(
          `${this.emailServiceUrl}/email/send-with-attachment`,
          payload,
        );
        console.log(
          `[NotificationService] Email service response (Agent Copy):`,
          response.data,
        );
      }
    } catch (error: any) {
      console.error(
        `[NotificationService] Error sending booking status email:`,
      );
      console.error(`Message:`, error.message);
      if (error.response) {
        console.error(`Response Status:`, error.response.status);
        console.error(`Response Data:`, error.response.data);
      }
    }
  }
}

export const notificationService = new NotificationService();
