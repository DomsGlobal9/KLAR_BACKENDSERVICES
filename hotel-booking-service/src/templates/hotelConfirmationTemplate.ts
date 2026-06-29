import { IBooking } from "../models/Booking.model";

export const generateHotelVoucherHTML = (booking: IBooking): string => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; background-color: #f4f7f6; color: #333; line-height: 1.6; }
            .container { max-width: 650px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
            .header { background: #1a73e8; color: #ffffff; padding: 25px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
            .content { padding: 30px; }
            .section { margin-bottom: 25px; }
            .section-title { font-size: 14px; text-transform: uppercase; color: #888; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 15px; letter-spacing: 0.5px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; }
            .label { font-weight: 600; color: #555; }
            .value { text-align: right; color: #111; max-width: 60%; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 13px; color: #777; border-top: 1px solid #eaeaea; }
            .status-badge { display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; background: #e6f4ea; color: #1e8e3e; margin-top: 10px; }
            .hotel-name { font-size: 18px; font-weight: 700; color: #1a73e8; margin-bottom: 5px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Hotel Booking Voucher</h1>
                <div class="status-badge">${booking.status}</div>
            </div>
            <div class="content">
                <div class="section">
                    <div class="section-title">Reservation Details</div>
                    <div class="row"><span class="label">Confirmation Number</span><span class="value">${booking.confirmationNumber}</span></div>
                    <div class="row"><span class="label">Check-in</span><span class="value">${new Date(booking.checkIn).toLocaleDateString()}</span></div>
                    <div class="row"><span class="label">Check-out</span><span class="value">${new Date(booking.checkOut).toLocaleDateString()}</span></div>
                </div>
                
                <div class="section">
                    <div class="section-title">Hotel Details</div>
                    <div class="hotel-name">${booking.hotelName || "N/A"}</div>
                    <div style="font-size: 13px; color: #666; margin-bottom: 15px;">${booking.hotelAddress || "N/A"}, ${booking.city || ""}</div>
                    ${booking.rooms
                      .map(
                        (room, index) => `
                        <div class="row"><span class="label">Room ${index + 1}</span><span class="value">${room.roomType || booking.roomType || "Standard Room"} (${room.guests} Guests)</span></div>
                    `,
                      )
                      .join("")}
                </div>

                <div class="section">
                    <div class="section-title">Guest Details</div>
                    <div class="row"><span class="label">Guest Name</span><span class="value">${booking.guestName || "N/A"}</span></div>
                    <div class="row"><span class="label">Contact</span><span class="value">${booking.guestEmail || "N/A"} | ${booking.guestMobile || "N/A"}</span></div>
                </div>

                <div class="section" style="background: #f8f9fa; padding: 15px; border-radius: 6px;">
                    <div class="row" style="margin-bottom: 0;"><span class="label">Total Amount Paid</span><span class="value" style="font-size: 18px; font-weight: 700; color: #1a73e8;">${booking.currencyCode} ${booking.totalAmount}</span></div>
                </div>
            </div>
            <div class="footer">
                Thank you for booking with Klar!<br>
                For any support, please contact us at support@klar.com
            </div>
        </div>
    </body>
    </html>
    `;
};
