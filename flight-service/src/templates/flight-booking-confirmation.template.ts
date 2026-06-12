export const flightBookingConfirmationTemplate = (data: any, logoBase64: string): string => {
    // Use unified data structure if available, fallback to old structure
    const unifiedData = data.unifiedData || data;
    
    // For backward compatibility, support both old and new structure
    const order = unifiedData.order || { BookingId: unifiedData.bookingId };
    const flights = unifiedData.flights || [];
    const travellers = unifiedData.travellers || [];
    const priceBreakdown = unifiedData.priceBreakdown || {};
    
    // Old structure fallbacks
    const air = unifiedData?.itemInfos?.AIR || {};
    const trips = air?.TripInformation || [];
    const allSegments = unifiedData.allSegments || trips.flatMap((trip: any) => trip?.SegmentInformation || []);
    const passengers = unifiedData.passengers || air?.TravellerInformation || travellers;
    const fare = unifiedData.fare || air?.totalPriceInfo?.totalFareDetail?.FareComponents || {};
    
    // Use totalPrice from priceBreakdown or fallback to old structure
    const totalAmount = priceBreakdown.totalPrice || fare.NetFare || data.totalPrice || 0;

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    };

    // Helper to format minutes to hours and minutes
    const formatDuration = (totalMinutes: any): string => {
        const mins = parseInt(totalMinutes, 10);
        if (isNaN(mins) || mins <= 0) return '0 HR';

        const hours = Math.floor(mins / 60);
        const remainingMinutes = mins % 60;

        if (remainingMinutes === 0) {
            return `${hours} HR`;
        }
        return `${hours} HR ${remainingMinutes} MIN`;
    };

    // AIRTIGHT PNR EXTRACTION PIPELINE (Updated for unified data)
    let resolvedPnr = unifiedData.bookingPnr || 'N/A';
    
    if (resolvedPnr === 'N/A' && flights.length > 0) {
        // Get PNR from first flight in unified structure
        resolvedPnr = flights[0]?.pnr || 'N/A';
    }
    
    if (resolvedPnr === 'N/A' && passengers && passengers.length > 0) {
        const passenger = passengers[0];
        if (passenger?.pnrDetails && Object.keys(passenger.pnrDetails).length > 0) {
            resolvedPnr = Object.values(passenger.pnrDetails)[0] as string;
        } else if (passenger?.pnr) {
            resolvedPnr = passenger.pnr;
        } else if (data?.pnr) {
            resolvedPnr = data.pnr;
        } else if (order?.Pnr || order?.pnr) {
            resolvedPnr = order.Pnr || order.pnr;
        }
    }
    
    if (resolvedPnr === 'N/A' && allSegments.length > 0) {
        // Scans through your Segment information lists to capture deep nested PNR references
        for (const seg of allSegments) {
            const tiArray = seg?.BaggageInfo?.tI || seg?.BaggageInfo?.ti || [];
            if (tiArray[0]?.pnrDetails && Object.keys(tiArray[0].pnrDetails).length > 0) {
                resolvedPnr = Object.values(tiArray[0].pnrDetails)[0] as string;
                break;
            } else if (tiArray[0]?.pnr) {
                resolvedPnr = tiArray[0].pnr;
                break;
            }
        }
    }

    // Get passenger details for display (Updated for unified data)
    const getPassengerDetails = (p: any) => {
        const title = p.Title || p.title || 'Mr/Ms';
        const firstName = p.FirstName || p.firstName || '';
        const lastName = p.LastName || p.lastName || '';
        const cabinClass = p.FareDetails?.CabinClass || p.cabinClass || p.paxType || 'ECONOMY';
        const classCode = p.FareDetails?.ClassCode || p.classCode || 'T';

        // Seat (handle both unified and old structure)
        let seatNumber = "Not Selected";
        if (p.seatNumbers && Object.keys(p.seatNumbers).length > 0) {
            seatNumber = Object.entries(p.seatNumbers)
                .map(([route, seat]: any) => `${route}: ${seat || "N/A"}`)
                .join("<br>");
        } else if (p?.SSR_Seat_Information && Object.keys(p.SSR_Seat_Information).length > 0) {
            seatNumber = Object.entries(p.SSR_Seat_Information)
                .map(([route, seat]: any) => `${route}: ${seat?.seatNo || "N/A"}`)
                .join("<br>");
        }

        // Meal
        let mealName = "Not Included";
        if (p?.SSR_Meal_Information && Object.keys(p.SSR_Meal_Information).length > 0) {
            mealName = Object.entries(p.SSR_Meal_Information)
                .map(([route, meal]: any) => `${route}: ${meal?.Description || "N/A"}`)
                .join("<br>");
        }
        
        // Baggage
        let baggageValue = "N/A";
        if (p.baggageInfo) {
            baggageValue = p.baggageInfo;
        } else if (p?.SSR_Baggage_Information && Object.keys(p.SSR_Baggage_Information).length > 0) {
            baggageValue = Object.entries(p.SSR_Baggage_Information)
                .map(([route, bag]: any) => `${route}: ${bag?.Description || "N/A"}`)
                .join("<br>");
        } else if (p?.FareDetails?.BaggageInfo?.CheckInBaggage) {
            baggageValue = p.FareDetails.BaggageInfo.CheckInBaggage;
        }

        // Handle baggage formatting to ensure space between number and unit (e.g., 15KG -> 15 KG)
        let rawBaggage = baggageValue || '15 KG';
        let formattedBaggage = String(rawBaggage).trim();
        const baggageMatch = formattedBaggage.match(/^(\d+)\s*([a-zA-Z]+)$/);
        if (baggageMatch) {
            formattedBaggage = `${baggageMatch[1]} ${baggageMatch[2].toUpperCase()}`;
        }

        return {
            title,
            firstName,
            lastName,
            cabinClass,
            classCode,
            seatNumber,
            mealName,
            baggageValue: formattedBaggage,
            pnrDetails: p.pnrDetails || {}
        };
    };

    // Get first passenger for display in some sections
    const firstPassenger = passengers.length > 0 ? getPassengerDetails(passengers[0]) : {
        title: '',
        firstName: '',
        lastName: '',
        cabinClass: '',
        classCode: '',
        seatNumber: '',
        mealName: '',
        baggageValue: '',
        pnrDetails: {}
    };

    return `
    <html>
    <head>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            body { font-family: 'Inter', sans-serif; color: #1e293b; padding: 40px; margin: 0; background: white; }
            
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
            .logo-img { width: 130px; height: auto; }
            
            .booking-header-info { text-align: right; }
            .label-sm { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
            .val-lg { font-size: 20px; font-weight: 800; color: #000; }
            .price-blue { color: #2563eb; font-size: 24px; font-weight: 800; margin-top: 4px; }

            .section-tag { font-size: 11px; font-weight: 800; color: #10b981; margin: 30px 0 10px; text-transform: uppercase; }
            
            .pass-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px;
    border-top: 1px solid #f1f5f9;
    padding-top: 15px;
    margin-bottom: 20px;
}
            .meta-box .val { font-size: 15px; font-weight: 700; color: #1e293b; margin-top: 4px; display: block; }

            .route-card { background: #f8fafc; border-radius: 24px; padding: 30px; margin: 30px 0; display: flex; align-items: center; justify-content: space-between; }
            .apt-code { font-size: 42px; font-weight: 800; margin: 0; color: #0f172a; line-height: 1; }
            .apt-name { font-size: 12px; color: #1e293b; font-weight: 700; margin-top: 4px; }
            .flight-time { font-size: 18px; font-weight: 800; margin-top: 8px; }
            
            .path-area { flex: 1; text-align: center; position: relative; padding: 0 20px; }
            .line { border-top: 2px solid #cbd5e1; position: absolute; top: 35%; left: 20px; right: 20px; }
            .plane { position: relative; z-index: 2; background: #f8fafc; padding: 0 10px; color: #2563eb; font-size: 14px; }
            .dur { font-size: 10px; font-weight: 800; color: #1e293b; margin-top: 20px; text-transform: uppercase; }

            .icon-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px 50px; margin: 40px 0; }
            .icon-item { display: flex; align-items: center; gap: 15px; }
            .icon-circle { width: 42px; height: 42px; background: #eff6ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #2563eb; font-size: 16px; flex-shrink: 0; }
            .icon-text-group { display: flex; flex-direction: column; }
            .icon-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
            .icon-val { font-size: 15px; font-weight: 700; color: #1e293b; }

            .info-card { background: #f8fafc; border-radius: 20px; padding: 25px; margin-top: 40px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .info-col h4 { font-size: 11px; font-weight: 800; margin: 0 0 12px 0; text-transform: uppercase; color: #1e293b; display: flex; align-items: center; gap: 8px; }
            .info-col ul { padding-left: 15px; margin: 0; }
            .info-col li { font-size: 11px; color: #475569; margin-bottom: 8px; line-height: 1.5; font-weight: 500; }

            .footer-branding { margin-top: 60px; text-align: right; }
            .footer-logo { width: 100px;}
            .support-bar { font-size: 11px; color: #94a3b8; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 15px; }
        </style>
    </head>
    <body>
        <div class="header">
            ${logoBase64 ? `<img src="${logoBase64}" class="logo-img">` : `<strong>KLAR TRAVELS</strong>`}
            <div class="booking-header-info">
                <div class="label-sm">Booking Reference</div>
                <div class="val-lg">${order.BookingId || 'N/A'}</div>
                <div class="label-sm" style="margin-top: 10px;">Total Amount Paid</div>
                <div class="price-blue">₹${totalAmount.toLocaleString('en-IN')}</div>
            </div>
        </div>

        <div class="section-tag">Passenger Information</div>
        ${passengers.map((p: any) => {
        const details = getPassengerDetails(p);
        const passengerPnr = details.pnrDetails && Object.keys(details.pnrDetails).length > 0
            ? Object.values(details.pnrDetails).join(", ")
            : (p.pnr || resolvedPnr);

        return `
            <div class="pass-grid">
    <div class="meta-box">
        <span class="label-sm">Name</span>
        <span class="val">
            ${details.title} ${details.firstName} ${details.lastName}
        </span>
    </div>

    <div class="meta-box">
        <span class="label-sm">PNR</span>
        <span class="val">
            ${passengerPnr}
        </span>
    </div>

    <div class="meta-box">
        <span class="label-sm">Class</span>
        <span class="val">
            ${details.cabinClass}
        </span>
    </div>

    <div class="meta-box">
        <span class="label-sm">Seat</span>
        <span class="val">
            ${details.seatNumber}
        </span>
    </div>

    <div class="meta-box">
        <span class="label-sm">Meal</span>
        <span class="val">
            ${details.mealName}
        </span>
    </div>

    <div class="meta-box">
        <span class="label-sm">Baggage</span>
        <span class="val">
            ${details.baggageValue}
        </span>
    </div>
</div>
            `;
    }).join("")}

    <div class="section-tag">
    Flight Segments (${allSegments.length})
</div>

        ${allSegments.length > 0 ? allSegments.map((seg: any) => `
        <div class="route-card">
            <div class="apt-group">
                <div class="apt-code">
                    ${seg.DepartureAirport?.cityCode ||
        seg.DepartureAirport?.SSRCode ||
        seg.from?.code ||
        'N/A'}
                </div>
                <div class="apt-name">${seg.DepartureAirport?.city || seg.from?.city || 'N/A'}</div>
                <div class="flight-time">${new Date(seg.DepartureTime || seg.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                <div class="label-sm">${formatDate(seg.DepartureTime || seg.departureTime)}</div>
            </div>
            <div class="path-area">
                <div class="line"></div>
                <span class="plane">✈</span>
                <div class="dur">${formatDuration(seg.Duration || seg.duration)} • ${seg.NumberOfStops === 0 ? 'NON-STOP' : `${seg.NumberOfStops} STOP`}</div>
            </div>
            <div class="apt-group" style="text-align: right;">
                <div class="apt-code">${seg.ArrivalAirport?.cityCode || seg.to?.code || 'N/A'}</div>
                <div class="apt-name">${seg.ArrivalAirport?.city || seg.to?.city || 'N/A'}</div>
                <div class="flight-time">${new Date(seg.ArrivalTime || seg.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                <div class="label-sm">${formatDate(seg.ArrivalTime || seg.arrivalTime)}</div>
            </div>
        </div>
        `).join('') : `
        <div class="route-card">
            <div class="apt-group">
                <div class="apt-code">N/A</div>
                <div class="apt-name">No flight data available</div>
            </div>
        </div>
        `}

        <div class="info-card">
            <div class="info-grid">
                <div class="info-col">
                    <h4>ⓘ Important Information</h4>
                    <ul>
                        <li>Web check-in opens 48 hours prior to departure.</li>
                        <li>Airport check-in counters close 60 minutes before departure.</li>
                        <li>Boarding gate closes 20 minutes before scheduled take-off.</li>
                    </ul>
                </div>
                <div class="info-col">
                    <h4>ID Requirements</h4>
                    <ul>
                        <li>Government-issued photo ID is mandatory for all passengers.</li>
                        <li>Digital copies on DigiLocker are accepted at all Indian airports.</li>
                        <li>Ensure name on ID matches the name on this confirmation exactly.</li>
                    </ul>
                </div>
            </div>
        </div>

        <div class="footer-branding">
            ${logoBase64 ? `<img src="${logoBase64}" class="footer-logo">` : ''}
        </div>
    </body>
    </html>
    `;
};