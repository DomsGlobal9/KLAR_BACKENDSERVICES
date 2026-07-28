import { ICabBooking } from "../models/CabBooking.model";

export const generateCabVoucherHTML = (booking: ICabBooking): string => {
    // Dynamic Extractions
    const clientEmail = booking.passenger?.email || "N/A";
    const clientPhone = booking.passenger?.phone || "N/A";
    const clientName = `${booking.passenger?.firstName || ''} ${booking.passenger?.lastName || ''}`.trim() || "Valued Guest";
    const vehicleName = `${booking.vehicleCategory || ''} ${booking.vehicleType || ''}`.trim() || "Standard Vehicle";
    const totalAmount = Number(booking.totalAmount || 0);
    const currencyCode = booking.currency || "INR";
    const displayStatus = String(booking.status || 'PENDING').toUpperCase();
    const logoDataUri = ""; // We can add the Klar logo URI if needed, for now use text

    const formatDate = (dateStr: any) => {
        if (!dateStr) return "N/A";
        return new Date(dateStr).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });
    };

    const formatCurrency = (val: number) => {
        return val.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Cab Confirmation</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 20px; background-color: #e8e8e8; }
          .container { max-width: 750px; margin: 0 auto; background: #ffffff; padding: 30px; border: 3px solid #000; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); position: relative; }
          .container::before { content: ''; position: absolute; top: 8px; left: 8px; right: 8px; bottom: 8px; border: 1px solid #ccc; pointer-events: none; border-radius: 8px; }
          .header { border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 15px; }
          .header table { width: 100%; border-collapse: collapse; }
          .header td { vertical-align: middle; padding: 4px 0; }
          .logo { max-height: 55px; width: auto; }
          .header-right { text-align: right; font-size: 11px; color: #333; line-height: 1.6; }
          .header-right .company-name { font-size: 15px; font-weight: bold; color: #000; letter-spacing: 1px; }
          .header-right .pnr { font-weight: bold; font-size: 14px; margin-top: 3px; }
          .info-table, .flight-table, .passenger-table, .seat-table, .fare-table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 10px 0; font-size: 12px; }
          .info-table td, .flight-table td, .passenger-table td, .seat-table td, .fare-table td { padding: 8px 10px; border: 1px solid #000; vertical-align: middle; }
          .flight-table .flight-header { font-weight: bold; font-size: 14px; background: #f5f5f5; text-align: left; padding: 8px 15px; }
          .flight-table .flight-header .status-right { float: right; }
          .status-badge { display: inline-block; padding: 2px 15px; border: 1px solid #28a745; border-radius: 4px; color: #28a745; font-weight: bold; font-size: 12px; background: #f0fff0; }
          .passenger-table .header-row, .fare-table .header-row { background: #f5f5f5; font-weight: bold; text-align: center; }
          .section-title { font-weight: bold; font-size: 15px; margin: 18px 0 8px; padding: 6px 0; border-bottom: 2px solid #000; }
          .footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #ccc; text-align: center; color: #888; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <table width="100%">
              <tbody>
                <tr>
                  <td>
                    ${logoDataUri ? `<img src="${logoDataUri}" alt="Klar Travels Logo" class="logo" />` : `<h2 style="margin: 0; font-weight: 800; color: #000">KLAR TRAVELS</h2>`}
                  </td>
                  <td class="header-right">
                    <div class="company-name">CAB BOOKING</div>
                    <div class="pnr">Ref: ${booking.klarBookingId || booking.bookingId || "PENDING"}</div>
                    <div style="margin-top: 4px">Status: ${displayStatus}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="section-title">GUEST INFORMATION</div>
          <table class="info-table">
            <tbody>
              <tr>
                <td>
                  <strong>Name:</strong> ${clientName.toUpperCase()}<br/>
                  <strong>Email:</strong> ${clientEmail}<br/>
                  <strong>Phone:</strong> ${clientPhone}
                </td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">JOURNEY DETAILS</div>
          <table class="info-table">
            <tbody>
              <tr>
                <td width="50%" style="background: #f5f5f5; font-weight: bold">Pickup Location</td>
                <td width="50%" style="background: #f5f5f5; font-weight: bold">Drop Location</td>
              </tr>
              <tr>
                <td>${booking.origin?.displayAddress || "N/A"}</td>
                <td>${booking.destination?.displayAddress || "N/A"}</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">VEHICLE DETAILS</div>
          <table class="info-table">
            <tbody>
              <tr>
                <td width="50%" style="background: #f5f5f5; font-weight: bold">Pickup Time</td>
                <td width="50%" style="background: #f5f5f5; font-weight: bold">Vehicle Type</td>
              </tr>
              <tr>
                <td>${formatDate(booking.pickupDate)}</td>
                <td>${vehicleName}</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">PAYMENT SUMMARY</div>
          <table class="info-table">
            <tbody>
              <tr>
                <td width="75%">Total Amount Paid</td>
                <td width="25%" style="text-align: right">${currencyCode} ${formatCurrency(totalAmount)}</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">IMPORTANT INFORMATION</div>
          <ul style="font-size: 12px; color: #555; padding-left: 20px">
            <li>Please be ready at the pickup location 10 minutes before the scheduled time.</li>
            <li>Tolls, parking, and state taxes may be extra if not explicitly included in the fare.</li>
            <li>Driver details will be shared via SMS/Email shortly before the journey.</li>
          </ul>

          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Klar Travels. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
    `;
};
