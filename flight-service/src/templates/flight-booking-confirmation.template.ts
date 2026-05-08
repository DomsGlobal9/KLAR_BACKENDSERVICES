export const flightBookingConfirmationTemplate = (data: any): string => {
    // Assuming 'data' here is the result of TripjackFieldMapper.map
    const order = data?.order || {};
    const air = data?.itemInfos?.AIR || {};
    const trip = air?.TripInformation?.[0] || {};
    const segments = trip?.SegmentInformation || [];
    const passenger = air?.TravellerInformation?.[0] || {};
    const fare = air?.totalPriceInfo?.totalFareDetail?.FareComponents || {};

    const formatCurrency = (val: number) => `₹${Number(val || 0).toLocaleString("en-IN")}`;

    return `
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
            .header { border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; }
            .section-title { background: #f3f4f6; padding: 5px 10px; font-weight: bold; margin-top: 20px; }
            .flight-card { border: 1px solid #e5e7eb; padding: 15px; margin-top: 10px; border-radius: 5px; }
            .flex { display: flex; justify-content: space-between; }
            .footer { margin-top: 30px; text-align: right; font-size: 1.2em; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">
            <div><h1>Klar Travels</h1><p>Flight Confirmation</p></div>
            <div style="text-align:right;">
                <p><strong>Booking Ref:</strong> ${order?.BookingId}</p>
                <p><strong>Status:</strong> ${order?.status}</p>
            </div>
        </div>

        <div class="section-title">PASSENGER DETAILS</div>
        <p>${passenger?.Title} ${passenger?.FirstName} ${passenger?.LastName} (${passenger?.PaxType})</p>

        <div class="section-title">ITINERARY</div>
        ${segments.map((seg: any) => `
            <div class="flight-card">
                <div class="flex">
                    <strong>${seg?.FlightDetails?.AirlineInfo?.AirlineName}</strong>
                    <span>${seg?.FlightDetails?.AirlineInfo?.SSRCode} - ${seg?.FlightDetails?.FirstName}</span>
                </div>
                <div class="flex" style="margin-top:10px;">
                    <div>
                        <p style="font-size:1.5em; margin:0;">${seg?.DepartureAirport?.cityCode}</p>
                        <p style="margin:0;">${new Date(seg?.DepartureTime).toLocaleString()}</p>
                    </div>
                    <div style="align-self:center;">✈️</div>
                    <div style="text-align:right;">
                        <p style="font-size:1.5em; margin:0;">${seg?.ArrivalAirport?.cityCode}</p>
                        <p style="margin:0;">${new Date(seg?.ArrivalTime).toLocaleString()}</p>
                    </div>
                </div>
            </div>
        `).join('')}

        <div class="footer">
            Total Paid: ${formatCurrency(fare?.NetFare)}
        </div>
    </body>
    </html>`;
};