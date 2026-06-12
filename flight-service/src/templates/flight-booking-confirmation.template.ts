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
        console.log("Passenger data:", JSON.stringify(p, null, 2));
        console.log("Seats array:", p.seats);
        console.log("Meals array:", p.meals);
        console.log("Baggage array:", p.baggage);
        const title = p.Title || p.title || '';
        const firstName = p.FirstName || p.firstName || '';
        const lastName = p.LastName || p.lastName || '';
        const cabinClass = p.FareDetails?.CabinClass || p.cabinClass || p.paxType || 'ECONOMY';
        const classCode = p.FareDetails?.ClassCode || p.classCode || 'T';

        // Handle unified data structure (seats array)
        let seatNumber = "Not Selected";
        if (p.seats && p.seats.length > 0) {
            seatNumber = p.seats
                .map((seat: any) => `${seat.route || seat.segmentKey}: ${seat.seatNumber || "N/A"}`)
                .join("<br>");
        }
        // Handle old structure: SSR_Seat_Information
        else if (p?.SSR_Seat_Information && Object.keys(p.SSR_Seat_Information).length > 0) {
            seatNumber = Object.entries(p.SSR_Seat_Information)
                .map(([route, seat]: any) => `${route}: ${seat?.seatNo || "N/A"}`)
                .join("<br>");
        }
        // Handle seatNumbers structure
        else if (p.seatNumbers && Object.keys(p.seatNumbers).length > 0) {
            seatNumber = Object.entries(p.seatNumbers)
                .map(([route, seat]: any) => `${route}: ${seat || "N/A"}`)
                .join("<br>");
        }

        // Handle unified meal data
        let mealName = "Not Included";
        if (p.meals && p.meals.length > 0) {
            mealName = p.meals
                .map((meal: any) => `${meal.route || meal.segmentKey}: ${meal.description || "N/A"}`)
                .join("<br>");
        }
        else if (p?.SSR_Meal_Information && Object.keys(p.SSR_Meal_Information).length > 0) {
            mealName = Object.entries(p.SSR_Meal_Information)
                .map(([route, meal]: any) => `${route}: ${meal?.Description || "N/A"}`)
                .join("<br>");
        }

        // Handle unified baggage data
        let baggageValue = "N/A";
        if (p.baggage && p.baggage.length > 0) {
            baggageValue = p.baggage
                .map((bag: any) => `${bag.route || bag.segmentKey}: ${bag.description || "N/A"}`)
                .join("<br>");
        }
        else if (p.baggageInfo) {
            baggageValue = p.baggageInfo;
        }
        else if (p?.SSR_Baggage_Information && Object.keys(p.SSR_Baggage_Information).length > 0) {
            baggageValue = Object.entries(p.SSR_Baggage_Information)
                .map(([route, bag]: any) => `${route}: ${bag?.Description || "N/A"}`)
                .join("<br>");
        }
        else if (p?.FareDetails?.BaggageInfo?.CheckInBaggage) {
            baggageValue = p.FareDetails.BaggageInfo.CheckInBaggage;
        }

        // Handle baggage formatting
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
    <!DOCTYPE html>
<html>
<head>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300..700;1,300..700&display=swap');
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #f4f7fc;
            margin: 0;
            padding: 40px 24px;
            color: #0f172a;
        }
        .email-container {
            max-width: 680px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 32px;
            box-shadow: 0 20px 35px -12px rgba(0, 0, 0, 0.08);
            overflow: hidden;
        }
        .email-content {
            padding: 32px 32px 40px;
        }

        /* header area */
        .header-flex {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            flex-wrap: wrap;
            gap: 20px;
            margin-bottom: 32px;
            padding-bottom: 20px;
            border-bottom: 2px solid #eef2ff;
        }
        .logo-img {
            max-height: 48px;
            width: auto;
        }
        .booking-ref-box {
            text-align: right;
        }
        .ref-label {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            color: #5b6e8c;
        }
        .ref-number {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 4px;
        }
        .price-total {
            font-size: 26px;
            font-weight: 800;
            color: #1e4f8a;
            margin-top: 6px;
        }

        /* section headings */
        .section-badge {
            display: inline-block;
            font-size: 12px;
            font-weight: 800;
            background: #e6f7f0;
            color: #11734c;
            padding: 4px 14px;
            border-radius: 40px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 20px 0 16px 0;
        }

        /* passenger card grid — modern, clean */
        .passenger-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            background: #fafcff;
            border-radius: 28px;
            border: 1px solid #e9edf2;
            padding: 20px;
            margin-bottom: 24px;
        }
        .info-chip {
            background: #ffffff;
            border-radius: 20px;
            padding: 8px 12px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }
        .info-chip .label-sm {
            font-size: 10px;
            font-weight: 700;
            color: #5b6e8c;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            display: block;
            margin-bottom: 6px;
        }
        .info-chip .val {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            word-break: break-word;
            line-height: 1.4;
        }
        .seat-baggage-multi {
            font-size: 13px;
            font-weight: 500;
            line-height: 1.3;
        }

        /* flight route card */
        .flight-card {
            background: #ffffff;
            border-radius: 28px;
            border: 1px solid #eef2fa;
            margin-bottom: 24px;
            transition: all 0.1s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
        }
        .flight-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 24px 24px;
            flex-wrap: wrap;
        }
        .airport-detail {
            min-width: 120px;
        }
        .apt-code {
            font-size: 28px;
            font-weight: 800;
            color: #0b2b42;
            letter-spacing: -0.5px;
        }
        .apt-city {
            font-size: 13px;
            font-weight: 600;
            color: #2c3e5c;
            margin-top: 4px;
        }
        .flight-time-dep {
            font-size: 16px;
            font-weight: 700;
            margin-top: 10px;
            color: #0f172a;
        }
        .flight-date {
            font-size: 10px;
            font-weight: 600;
            color: #5b6e8c;
            text-transform: uppercase;
            margin-top: 3px;
        }
        .journey-middle {
            flex: 1;
            text-align: center;
            padding: 0 8px;
            position: relative;
        }
        .dotted-line {
            border-top: 2px dashed #cbd9f0;
            position: relative;
            top: 10px;
        }
        .plane-icon {
            background: white;
            display: inline-block;
            padding: 0 12px;
            font-size: 18px;
            color: #2563eb;
            font-weight: 600;
            position: relative;
            top: -12px;
        }
        .duration-badge {
            background: #f0f4fe;
            border-radius: 40px;
            display: inline-block;
            padding: 4px 14px;
            font-size: 11px;
            font-weight: 800;
            color: #1e4f8a;
            margin-top: 12px;
        }
        .stops-info {
            font-size: 10px;
            font-weight: 600;
            color: #4c6f9c;
            margin-top: 6px;
        }

        /* amenities grid - FIXED for route-specific details */
        .amenities-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 18px;
            background: #f9fbfe;
            border-radius: 24px;
            padding: 20px;
            margin: 20px 0 28px;
        }
        .amenity-item {
            display: flex;
            align-items: flex-start;
            gap: 14px;
        }
        .icon-bg {
            width: 44px;
            height: 44px;
            background: #eef3ff;
            border-radius: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            flex-shrink: 0;
        }
        .amenity-text {
            flex: 1;
        }
        .amenity-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            color: #5b6e8c;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        }
        .amenity-value {
            font-size: 13px;
            font-weight: 600;
            color: #0f172a;
            line-height: 1.4;
        }
        .route-detail-item {
            font-size: 12px;
            color: #334155;
            margin-top: 4px;
            padding-left: 0;
        }
        .route-detail-item strong {
            font-weight: 700;
            color: #1e4f8a;
        }

        /* info card */
        .info-panel {
            background: #f0f4fa;
            border-radius: 24px;
            padding: 20px 24px;
            margin-top: 32px;
        }
        .info-panel-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 32px;
            justify-content: space-between;
        }
        .info-block h4 {
            font-size: 12px;
            font-weight: 800;
            margin: 0 0 12px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #1e293b;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .info-block ul {
            margin: 0;
            padding-left: 18px;
        }
        .info-block li {
            font-size: 12px;
            font-weight: 500;
            color: #334155;
            margin-bottom: 8px;
        }

        .footer-section {
            margin-top: 40px;
            text-align: right;
            border-top: 1px solid #edf2f7;
            padding-top: 24px;
        }
        .footer-logo {
            max-height: 38px;
            width: auto;
            opacity: 0.8;
        }
        .support-text {
            font-size: 10px;
            color: #8ba0bc;
            margin-top: 16px;
        }

        @media (max-width: 550px) {
            .email-content { padding: 20px; }
            .passenger-grid { grid-template-columns: 1fr; gap: 12px; }
            .flight-row { flex-direction: column; gap: 20px; align-items: flex-start; }
            .journey-middle { width: 100%; text-align: center; margin-top: 8px; }
            .amenities-grid { grid-template-columns: 1fr; }
            .info-panel-grid { flex-direction: column; gap: 20px; }
        }
    </style>
</head>
<body>
<div class="email-container">
    <div class="email-content">
        <!-- Header: Logo + Booking / Total -->
        <div class="header-flex">
            ${logoBase64 ? `<img src="${logoBase64}" class="logo-img" alt="brand">` : `<strong style="font-size:22px; font-weight:800;">KLAR TRAVELS</strong>`}
            <div class="booking-ref-box">
                <div class="ref-label">Booking reference</div>
                <div class="ref-number">${order.BookingId || 'N/A'}</div>
                <div class="ref-label" style="margin-top: 12px;">Total amount paid</div>
                <div class="price-total">₹${totalAmount.toLocaleString('en-IN')}</div>
            </div>
        </div>

        <!-- Passenger Information Section -->
        <div class="section-badge">✈️ Passengers & details</div>
        ${passengers.map((p: any) => {
            const details = getPassengerDetails(p);
            const passengerPnr = details.pnrDetails && Object.keys(details.pnrDetails).length > 0
                ? Object.values(details.pnrDetails).join(", ")
                : (p.pnr || resolvedPnr);
            return `
            <div class="passenger-grid">
                <div class="info-chip">
                    <span class="label-sm">Full name</span>
                    <span class="val">${details.title} ${details.firstName} ${details.lastName}</span>
                </div>
                <div class="info-chip">
                    <span class="label-sm">PNR / Record locator</span>
                    <span class="val">${passengerPnr}</span>
                </div>
                <div class="info-chip">
                    <span class="label-sm">Cabin class</span>
                    <span class="val">${details.cabinClass}</span>
                </div>
                <div class="info-chip">
                    <span class="label-sm">Seat assignment</span>
                    <span class="val seat-baggage-multi">${details.seatNumber !== "Not Selected" ? details.seatNumber : "—"}</span>
                </div>
                <div class="info-chip">
                    <span class="label-sm">Meal preference</span>
                    <span class="val seat-baggage-multi">${details.mealName}</span>
                </div>
                <div class="info-chip">
                    <span class="label-sm">Check-in baggage</span>
                    <span class="val">${details.baggageValue}</span>
                </div>
            </div>
            `;
        }).join("")}

        <!-- Flight segments display -->
        <div class="section-badge">🛫 Flight itinerary (${allSegments.length} segment${allSegments.length !== 1 ? 's' : ''})</div>
        ${allSegments.length > 0 ? allSegments.map((seg: any) => {
            const depCode = seg.DepartureAirport?.cityCode || seg.DepartureAirport?.SSRCode || seg.from?.code || 'N/A';
            const depCity = seg.DepartureAirport?.city || seg.from?.city || 'N/A';
            const depTimeRaw = seg.DepartureTime || seg.departureTime;
            const depTimeFormatted = depTimeRaw ? new Date(depTimeRaw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
            const depDateFormatted = formatDate(depTimeRaw);
            
            const arrCode = seg.ArrivalAirport?.cityCode || seg.to?.code || 'N/A';
            const arrCity = seg.ArrivalAirport?.city || seg.to?.city || 'N/A';
            const arrTimeRaw = seg.ArrivalTime || seg.arrivalTime;
            const arrTimeFormatted = arrTimeRaw ? new Date(arrTimeRaw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
            const arrDateFormatted = formatDate(arrTimeRaw);
            
            const durationMins = seg.Duration || seg.duration;
            const stops = seg.NumberOfStops !== undefined ? seg.NumberOfStops : 0;
            const stopText = stops === 0 ? 'NON-STOP' : `${stops} STOP${stops > 1 ? 'S' : ''}`;
            return `
            <div class="flight-card">
                <div class="flight-row">
                    <div class="airport-detail">
                        <div class="apt-code">${depCode}</div>
                        <div class="apt-city">${depCity}</div>
                        <div class="flight-time-dep">${depTimeFormatted}</div>
                        <div class="flight-date">${depDateFormatted}</div>
                    </div>
                    <div class="journey-middle">
                        <div class="dotted-line"></div>
                        <div class="plane-icon">✈️</div>
                        <div class="duration-badge">${formatDuration(durationMins)}</div>
                        <div class="stops-info">${stopText}</div>
                    </div>
                    <div class="airport-detail" style="text-align: right;">
                        <div class="apt-code">${arrCode}</div>
                        <div class="apt-city">${arrCity}</div>
                        <div class="flight-time-dep">${arrTimeFormatted}</div>
                        <div class="flight-date">${arrDateFormatted}</div>
                    </div>
                </div>
            </div>
            `;
        }).join('') : `
        <div class="flight-card" style="padding: 28px; text-align:center;">
            <div class="apt-code" style="font-size:18px;">⚠️ No flight segment data available</div>
            <div class="apt-city" style="margin-top:6px;">Please contact support for itinerary details</div>
        </div>
        `}

        <!-- Unified Amenities: Display route-specific details for first passenger (representative) -->
        <div class="section-badge">🎒 Onboard & services</div>
        <div class="amenities-grid">
            ${(() => {
                // Get first passenger details for amenities
                const firstPax = passengers[0];
                if (!firstPax) return '<div>No passenger data available</div>';
                
                const details = getPassengerDetails(firstPax);
                
                // Helper to parse route-specific details from formatted strings
                const parseRouteDetails = (formattedString: string) => {
                    if (!formattedString || formattedString === "Not Selected" || formattedString === "Not Included") {
                        return [];
                    }
                    const lines = formattedString.split('<br>');
                    return lines.filter(line => line.trim().length > 0);
                };
                
                const seatRoutes = parseRouteDetails(details.seatNumber);
                const mealRoutes = parseRouteDetails(details.mealName);
                const baggageRoutes = parseRouteDetails(details.baggageValue);
                
                return `
                <div class="amenity-item">
                    <div class="icon-bg">🪑</div>
                    <div class="amenity-text">
                        <div class="amenity-label">Seat preference</div>
                        <div class="amenity-value">
                            ${seatRoutes.length > 0 ? seatRoutes.map(route => `<div class="route-detail-item">${route}</div>`).join('') : '<div>—</div>'}
                        </div>
                    </div>
                </div>
                <div class="amenity-item">
                    <div class="icon-bg">🍽️</div>
                    <div class="amenity-text">
                        <div class="amenity-label">Meal</div>
                        <div class="amenity-value">
                            ${mealRoutes.length > 0 ? mealRoutes.map(route => `<div class="route-detail-item">${route}</div>`).join('') : '<div>Not included</div>'}
                        </div>
                    </div>
                </div>
                <div class="amenity-item">
                    <div class="icon-bg">🧳</div>
                    <div class="amenity-text">
                        <div class="amenity-label">Baggage allowance</div>
                        <div class="amenity-value">
                            ${baggageRoutes.length > 0 ? baggageRoutes.map(route => `<div class="route-detail-item">${route}</div>`).join('') : '<div>${details.baggageValue || "15 KG"}</div>'}
                        </div>
                    </div>
                </div>
                <div class="amenity-item">
                    <div class="icon-bg">⭐</div>
                    <div class="amenity-text">
                        <div class="amenity-label">Cabin class</div>
                        <div class="amenity-value">${details.cabinClass}</div>
                    </div>
                </div>
                `;
            })()}
        </div>

        <!-- Important & ID requirements -->
        <div class="info-panel">
            <div class="info-panel-grid">
                <div class="info-block">
                    <h4>📌 Important information</h4>
                    <ul>
                        <li>Web check-in opens 48 hours prior to departure.</li>
                        <li>Airport check-in counters close 60 minutes before departure.</li>
                        <li>Boarding gate closes 20 minutes before scheduled take-off.</li>
                    </ul>
                </div>
                <div class="info-block">
                    <h4>🪪 ID Requirements</h4>
                    <ul>
                        <li>Government-issued photo ID is mandatory for all passengers.</li>
                        <li>Digital copies on DigiLocker are accepted at all Indian airports.</li>
                        <li>Ensure name on ID matches the name on this confirmation exactly.</li>
                    </ul>
                </div>
            </div>
        </div>

        <!-- Footer with logo -->
        <div class="footer-section">
            ${logoBase64 ? `<img src="${logoBase64}" class="footer-logo" alt="brand">` : `<span style="font-weight:600;">KLAR TRAVELS</span>`}
            <div class="support-text">For assistance, please contact your travel agent or support team</div>
        </div>
    </div>
</div>
</body>
</html>
    `;
};