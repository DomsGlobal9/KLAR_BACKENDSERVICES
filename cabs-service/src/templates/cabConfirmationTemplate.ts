import { ICabBooking } from "../models/CabBooking.model";

export const generateCabVoucherHTML = (booking: ICabBooking): string => {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f7f6; color: #333; line-height: 1.6; }
            .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
            .header { background: #1a73e8; color: #ffffff; padding: 25px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
            .content { padding: 30px; }
            .section { margin-bottom: 25px; }
            .section-title { font-size: 14px; text-transform: uppercase; color: #888; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 15px; letter-spacing: 0.5px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; }
            .label { font-weight: 600; color: #555; }
            .value { text-align: right; color: #111; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 13px; color: #777; border-top: 1px solid #eaeaea; }
            .status-badge { display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; background: #e6f4ea; color: #1e8e3e; margin-top: 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Cab Booking Confirmed</h1>
                <div class="status-badge">${booking.status}</div>
            </div>
            <div class="content">
                <div class="section">
                    <div class="section-title">Booking Details</div>
                    <div class="row"><span class="label">Booking ID</span><span class="value">${booking.bookingId}</span></div>
                    <div class="row"><span class="label">Date</span><span class="value">${new Date(booking.pickupDate).toLocaleString()}</span></div>
                </div>
                
                <div class="section">
                    <div class="section-title">Journey</div>
                    <div class="row"><span class="label">From</span><span class="value">${booking.origin.displayAddress}</span></div>
                    <div class="row"><span class="label">To</span><span class="value">${booking.destination.displayAddress}</span></div>
                </div>

                <div class="section">
                    <div class="section-title">Vehicle & Passenger</div>
                    <div class="row"><span class="label">Vehicle Type</span><span class="value">${booking.vehicleCategory} ${booking.vehicleType}</span></div>
                    <div class="row"><span class="label">Passenger</span><span class="value">${booking.passenger.firstName} ${booking.passenger.lastName}</span></div>
                    <div class="row"><span class="label">Contact</span><span class="value">${booking.passenger.phone}</span></div>
                </div>

                <div class="section" style="background: #f8f9fa; padding: 15px; border-radius: 6px;">
                    <div class="row" style="margin-bottom: 0;"><span class="label">Total Amount Paid</span><span class="value" style="font-size: 18px; font-weight: 700; color: #1a73e8;">${booking.currency} ${booking.totalAmount}</span></div>
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
