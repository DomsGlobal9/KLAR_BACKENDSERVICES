export const flightBookingConfirmationTemplate = (data: any, logoBase64: string): string => {
    const order = data?.order || {};
    const air = data?.itemInfos?.AIR || {};
    const trip = air?.TripInformation?.[0] || {};
    const segments = trip?.SegmentInformation || [];
    const passenger = air?.TravellerInformation?.[0] || {};
    const fare = air?.totalPriceInfo?.totalFareDetail?.FareComponents || {};

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    };

    return `
    <html>
    <head>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; padding: 20px; line-height: 1.4; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
            .logo { width: 120px; }
            .booking-ref-box { text-align: right; }
            .label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
            .value-bold { font-size: 16px; font-weight: 700; color: #0f172a; }
            
            .section-header { background: #f8fafc; padding: 8px 12px; font-size: 13px; font-weight: 700; border-left: 4px solid #0f172a; margin: 20px 0 10px 0; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { text-align: left; font-size: 11px; color: #64748b; padding: 8px; border-bottom: 1px solid #e2e8f0; }
            td { padding: 12px 8px; font-size: 13px; font-weight: 600; border-bottom: 1px solid #f1f5f9; }

            .itinerary-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 15px; }
            .flight-row { display: flex; justify-content: space-between; align-items: center; }
            .airport-box { flex: 1; }
            .airport-code { font-size: 24px; font-weight: 800; margin: 0; }
            .airport-name { font-size: 12px; color: #64748b; }
            .time { font-size: 16px; font-weight: 700; margin-top: 4px; }
            
            .mid-info { text-align: center; flex: 1; color: #94a3b8; }
            .duration { font-size: 10px; font-weight: 700; margin-bottom: 5px; }
            
            .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 15px; }
            .meta-item { background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #f1f5f9; }

            .footer-info { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 11px; color: #64748b; }
            .total-box { text-align: right; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="header">
            <img src="${logoBase64}" class="logo" alt="Klar Travels">
            <div class="booking-ref-box">
                <div class="label">Booking Reference</div>
                <div class="value-bold">${order.BookingId}</div>
                <div style="margin-top: 10px;">
                    <div class="label">Status</div>
                    <div style="color: #059669; font-weight: 700;">${order.status}</div>
                </div>
            </div>
        </div>

        <div class="section-header">PASSENGER INFORMATION</div>
        <table>
            <thead>
                <tr>
                    <th>PASSENGER NAME</th>
                    <th>PNR</th>
                    <th>TICKET TYPE</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${passenger.Title} ${passenger.FirstName} ${passenger.LastName}</td>
                    <td>${passenger.pnrDetails?.['JAI-DEL'] || 'N/A'}</td>
                    <td>${passenger.FareDetails?.CabinClass} (${passenger.PaxType})</td>
                </tr>
            </tbody>
        </table>

        <div class="section-header">FLIGHT ITINERARY</div>
        ${segments.map((seg: any) => `
            <div class="itinerary-card">
                <div style="margin-bottom: 15px; font-size: 12px; font-weight: 700; color: #1d4ed8;">
                    ${seg.FlightDetails.AirlineInfo.AirlineName} | ${seg.FlightDetails.AirlineInfo.SSRCode}-${seg.FlightDetails.FirstName}
                </div>
                <div class="flight-row">
                    <div class="airport-box">
                        <p class="airport-code">${seg.DepartureAirport.cityCode}</p>
                        <span class="airport-name">${seg.DepartureAirport.city}</span>
                        <div class="time">${new Date(seg.DepartureTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        <div style="font-size: 11px;">${formatDate(seg.DepartureTime)}</div>
                    </div>
                    
                    <div class="mid-info">
                        <div class="duration">${seg.Duration} MINS NON-STOP</div>
                        <div style="font-size: 20px;">✈</div>
                    </div>

                    <div class="airport-box" style="text-align: right;">
                        <p class="airport-code">${seg.ArrivalAirport.cityCode}</p>
                        <span class="airport-name">${seg.ArrivalAirport.city}</span>
                        <div class="time">${new Date(seg.ArrivalTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        <div style="font-size: 11px;">${formatDate(seg.ArrivalTime)}</div>
                    </div>
                </div>
            </div>
        `).join('')}

        <div class="meta-grid">
            <div class="meta-item">
                <div class="label">Baggage</div>
                <div style="font-size: 12px; font-weight: 700;">${passenger.FareDetails.BaggageInfo.CheckInBaggage} Check-in</div>
            </div>
            <div class="meta-item">
                <div class="label">Seat</div>
                <div style="font-size: 12px; font-weight: 700;">Confirmed</div>
            </div>
            <div class="meta-item">
                <div class="label">Meal</div>
                <div style="font-size: 12px; font-weight: 700;">${passenger.FareDetails.MealIncluded ? 'Included' : 'Not Included'}</div>
            </div>
            <div class="meta-item">
                <div class="label">Class</div>
                <div style="font-size: 12px; font-weight: 700;">${passenger.FareDetails.ClassCode}</div>
            </div>
        </div>

        <div class="total-box">
            <div class="label">Total Amount Paid</div>
            <div class="value-bold" style="font-size: 24px;">₹${fare.NetFare.toLocaleString('en-IN')}</div>
        </div>

        <div class="footer-info">
            <strong>Important Note:</strong> Web check-in opens 48 hours prior to departure. Please carry a valid government ID. Digital copies on DigiLocker are accepted at all Indian airports.
        </div>
    </body>
    </html>
    `;
};