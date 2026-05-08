export const flightBookingConfirmationTemplate = (data: any): string => {
    const order = data?.order || {};
    const air = data?.itemInfos?.AIR || {};
    const tripInfo = air?.TripInformation?.[0]?.SegmentInformation?.[0] || {};
    const passenger = air?.TravellerInformation?.[0] || {};
    const fare = air?.totalPriceInfo?.totalFareDetail?.FareComponents || {};

    const formatCurrency = (val: number) => `₹${Number(val || 0).toLocaleString("en-IN")}`;
    
    return `
    <html>
    <head>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; padding: 40px; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 20px; }
            .booking-ref { text-align: right; }
            .ref-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
            .ref-value { font-size: 18px; font-weight: bold; color: #0f172a; }
            .section-title { background: #f1f5f9; padding: 8px 12px; font-size: 14px; font-weight: bold; margin: 30px 0 15px 0; border-radius: 4px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { text-align: left; font-size: 12px; color: #64748b; padding-bottom: 8px; }
            td { font-size: 14px; font-weight: 500; padding: 4px 0; }
            .flight-info { display: flex; justify-content: space-between; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; }
            .city-code { font-size: 24px; font-weight: 800; }
            .amount-box { margin-top: 30px; text-align: right; border-top: 1px solid #e2e8f0; padding-top: 15px; }
            .amount-val { font-size: 22px; font-weight: bold; color: #059669; }
        </style>
    </head>
    <body>
        <div class="header">
            <div><h1 style="margin:0;">Klar Travels</h1><small>FLIGHT CONFIRMATION</small></div>
            <div class="booking-ref">
                <div class="ref-label">Booking Reference</div>
                <div class="ref-value">${order?.BookingId || "N/A"}</div>
            </div>
        </div>

        <div class="section-title">PASSENGER INFORMATION</div>
        <table>
            <tr>
                <th>NAME</th>
                <th>TICKET TYPE</th>
                <th>BAGGAGE</th>
            </tr>
            <tr>
                <td>${passenger?.Title} ${passenger?.FirstName} ${passenger?.LastName}</td>
                <td>${passenger?.FareDetails?.CabinClass || "Economy"}</td>
                <td>${passenger?.FareDetails?.BaggageInfo?.CheckInBaggage || "15KG"}</td>
            </tr>
        </table>

        <div class="section-title">FLIGHT DETAILS</div>
        <div class="flight-info">
            <div>
                <div class="city-code">${tripInfo?.DepartureAirport?.cityCode}</div>
                <div>${tripInfo?.DepartureAirport?.city}</div>
                <div>${new Date(tripInfo?.DepartureTime).toLocaleString()}</div>
            </div>
            <div style="text-align:center; flex-grow: 1; align-self: center; color: #94a3b8;">
                ✈️<br/><small>${tripInfo?.Duration} MINS NON-STOP</small>
            </div>
            <div style="text-align:right;">
                <div class="city-code">${tripInfo?.ArrivalAirport?.cityCode}</div>
                <div>${tripInfo?.ArrivalAirport?.city}</div>
                <div>${new Date(tripInfo?.ArrivalTime).toLocaleString()}</div>
            </div>
        </div>

        <div class="amount-box">
            <span class="ref-label">TOTAL AMOUNT PAID</span><br/>
            <span class="amount-val">${formatCurrency(fare?.NetFare)}</span>
        </div>
    </body>
    </html>`;
};