export const flightAgencyBookingConfirmationTemplate = (data: any, logoBase64: string): string => {
    const order = data?.order || {};
    const air = data?.itemInfos?.AIR || {};
    const trip = air?.TripInformation?.[0] || {};
    const segments = trip?.SegmentInformation || [];
    
    // Safely fallback to root level or nested structure for passenger arrays
    const passenger = air?.TravellerInformation?.[0] || data?.travellers?.[0] || {};
    
    // Financial numbers extraction
    const totalPrice = data?.totalPrice ?? 0;
    const markupPrice = data?.markupPrice ?? 0;
    const tripjackPrice = data?.tripjackPrice ?? 0;

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    };

    const pnr = passenger.pnrDetails ? Object.values(passenger.pnrDetails)[0] : (data?.pnr || 'N/A');

    // Combine fields if necessary to match the structure
    const title = passenger.Title || passenger.title || 'Mr';
    const firstName = passenger.FirstName || passenger.firstName || '';
    const lastName = passenger.LastName || passenger.lastName || '';
    const cabinClass = passenger.FareDetails?.CabinClass || passenger.paxType || 'ECONOMY';
    const classCode = passenger.FareDetails?.ClassCode || 'S';

    return `
    <html>
    <head>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            body { font-family: 'Inter', sans-serif; color: #1e293b; padding: 40px; margin: 0; background: white; }
            
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; }
            .logo-img { width: 130px; height: auto; }
            
            .booking-header-info { text-align: right; }
            .label-sm { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
            .val-lg { font-size: 20px; font-weight: 800; color: #000; }
            .price-blue { color: #2563eb; font-size: 24px; font-weight: 800; margin-top: 4px; }

            /* Agency Financial Panel Specific Styling */
            .agency-financial-panel { background: #f0fdf4; border: 1.5px dashed #4ade80; border-radius: 16px; padding: 18px 24px; margin: 20px 0 25px 0; }
            .agency-title-tag { font-size: 11px; font-weight: 800; color: #166534; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;}
            .financial-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; }
            .financial-box { background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
            .financial-box .price-val { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px; }
            .financial-box .price-val.markup { color: #ea580c; }
            .financial-box .price-val.total { color: #16a34a; }

            .section-tag { font-size: 11px; font-weight: 800; color: #10b981; margin: 25px 0 10px; text-transform: uppercase; }
            
            .pass-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; border-top: 1px solid #f1f5f9; padding-top: 15px; }
            .meta-box .val { font-size: 15px; font-weight: 700; color: #1e293b; margin-top: 4px; display: block; }

            .route-card { background: #f8fafc; border-radius: 24px; padding: 30px; margin: 25px 0; display: flex; align-items: center; justify-content: space-between; }
            .apt-code { font-size: 42px; font-weight: 800; margin: 0; color: #0f172a; line-height: 1; }
            .apt-name { font-size: 12px; color: #1e293b; font-weight: 700; margin-top: 4px; }
            .flight-time { font-size: 18px; font-weight: 800; margin-top: 8px; }
            
            .path-area { flex: 1; text-align: center; position: relative; padding: 0 20px; }
            .line { border-top: 2px solid #cbd5e1; position: absolute; top: 35%; left: 20px; right: 20px; }
            .plane { position: relative; z-index: 2; background: #f8fafc; padding: 0 10px; color: #2563eb; font-size: 14px; }
            .dur { font-size: 10px; font-weight: 800; color: #1e293b; margin-top: 20px; text-transform: uppercase; }

            .icon-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px 50px; margin: 30px 0; }
            .icon-item { display: flex; align-items: center; gap: 15px; }
            .icon-circle { width: 42px; height: 42px; background: #eff6ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #2563eb; font-size: 16px; flex-shrink: 0; }
            .icon-text-group { display: flex; flex-direction: column; }
            .icon-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
            .icon-val { font-size: 15px; font-weight: 700; color: #1e293b; }

            .info-card { background: #f8fafc; border-radius: 20px; padding: 25px; margin-top: 35px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .info-col h4 { font-size: 11px; font-weight: 800; margin: 0 0 12px 0; text-transform: uppercase; color: #1e293b; display: flex; align-items: center; gap: 8px; }
            .info-col ul { padding-left: 15px; margin: 0; }
            .info-col li { font-size: 11px; color: #475569; margin-bottom: 8px; line-height: 1.5; font-weight: 500; }

            .footer-branding { margin-top: 45px; text-align: right; }
            .footer-logo { width: 100px;}
        </style>
    </head>
    <body>
        <div class="header">
            ${logoBase64 ? `<img src="${logoBase64}" class="logo-img">` : `<strong>KLAR TRAVELS</strong>`}
            <div class="booking-header-info">
                <div class="label-sm">Booking Reference</div>
                <div class="val-lg">${data.bookingId || order.BookingId || 'N/A'}</div>
                <div class="label-sm" style="margin-top: 10px;">Customer Total Paid</div>
                <div class="price-blue">₹${totalPrice.toLocaleString('en-IN')}</div>
            </div>
        </div>

        <div class="agency-financial-panel">
            <div class="agency-title-tag">
                💼 Agency Internal Financial Breakdown (Not Shared with Client)
            </div>
            <div class="financial-grid">
                <div class="financial-box">
                    <div class="label-sm">Tripjack Net Price</div>
                    <div class="price-val">₹${tripjackPrice.toLocaleString('en-IN')}</div>
                </div>
                <div class="financial-box">
                    <div class="label-sm">Configured Markup</div>
                    <div class="price-val markup">+ ₹${markupPrice.toLocaleString('en-IN')}</div>
                </div>
                <div class="financial-box">
                    <div class="label-sm">Gross Collection (Total)</div>
                    <div class="price-val total">₹${totalPrice.toLocaleString('en-IN')}</div>
                </div>
            </div>
        </div>

        <div class="section-tag">Passenger Information</div>
        <div class="pass-grid">
            <div class="meta-box"><span class="label-sm">Name</span><span class="val">${title} ${firstName} ${lastName}</span></div>
            <div class="meta-box"><span class="label-sm">PNR</span><span class="val">${pnr}</span></div>
            <div class="meta-box"><span class="label-sm">Ticket Type</span><span class="val">${cabinClass} (${classCode})</span></div>
        </div>

        ${segments.length > 0 ? segments.map((seg: any) => `
        <div class="route-card">
            <div class="apt-group">
                <div class="apt-code">${seg.DepartureAirport?.cityCode || 'JAI'}</div>
                <div class="apt-name">${seg.DepartureAirport?.city || 'Jaipur'}</div>
                <div class="flight-time">${seg.DepartureTime ? new Date(seg.DepartureTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}) : '13:40'}</div>
                <div class="label-sm">${formatDate(seg.DepartureTime || '2026-05-07T13:40:00')}</div>
            </div>
            <div class="path-area">
                <div class="line"></div>
                <span class="plane">✈</span>
                <div class="dur">${seg.Duration || '50'} MINS • NON-STOP</div>
            </div>
            <div class="apt-group" style="text-align: right;">
                <div class="apt-code">${seg.ArrivalAirport?.cityCode || 'DEL'}</div>
                <div class="apt-name">${seg.ArrivalAirport?.city || 'Delhi'}</div>
                <div class="flight-time">${seg.ArrivalTime ? new Date(seg.ArrivalTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}) : '14:30'}</div>
                <div class="label-sm">${formatDate(seg.ArrivalTime || '2026-05-07T14:30:00')}</div>
            </div>
        </div>
        `).join('') : `
        <div class="route-card">
            <div class="apt-group">
                <div class="apt-code">JAI</div>
                <div class="apt-name">Jaipur</div>
                <div class="flight-time">13:40</div>
                <div class="label-sm">07 MAY 2026</div>
            </div>
            <div class="path-area">
                <div class="line"></div>
                <span class="plane">✈</span>
                <div class="dur">50 MINS • NON-STOP</div>
            </div>
            <div class="apt-group" style="text-align: right;">
                <div class="apt-code">DEL</div>
                <div class="apt-name">Delhi</div>
                <div class="flight-time">14:30</div>
                <div class="label-sm">07 MAY 2026</div>
            </div>
        </div>
        `}

        <div class="icon-grid">
            <div class="icon-item">
                <div class="icon-circle">💺</div>
                <div class="icon-text-group">
                    <div class="icon-label">Seat</div>
                    <div class="icon-val">Confirmed</div>
                </div>
            </div>
            <div class="icon-item">
                <div class="icon-circle">🎒</div>
                <div class="icon-text-group">
                    <div class="icon-label">Baggage</div>
                    <div class="icon-val">${passenger.FareDetails?.BaggageInfo?.CheckInBaggage || '15 Kg'}</div>
                </div>
            </div>
            <div class="icon-item">
                <div class="icon-circle">🍽</div>
                <div class="icon-text-group">
                    <div class="icon-label">Meal Preference</div>
                    <div class="icon-val">${passenger.FareDetails?.MealIncluded ? 'Included' : 'Not Included'}</div>
                </div>
            </div>
            <div class="icon-item">
                <div class="icon-circle">📊</div>
                <div class="icon-text-group">
                    <div class="icon-label">Class</div>
                    <div class="icon-val">${cabinClass}</div>
                </div>
            </div>
        </div>

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