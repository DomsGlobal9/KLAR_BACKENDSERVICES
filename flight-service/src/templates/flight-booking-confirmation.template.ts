export const flightBookingConfirmationTemplate = (data: any, logoBase64: string): string => {
    const order = data?.order || {};
    const air = data?.itemInfos?.AIR || {};
    const trip = air?.TripInformation?.[0] || {};
    const segments = trip?.SegmentInformation || [];
    const passenger = air?.TravellerInformation?.[0] || {};
    const fare = air?.totalPriceInfo?.totalFareDetail?.FareComponents || {};

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    };

    const pnr = passenger.pnrDetails ? Object.values(passenger.pnrDetails)[0] : 'N/A';

    return `
    <html>
    <head>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            body { font-family: 'Inter', sans-serif; color: #1e293b; padding: 30px; margin: 0; background: white; }
            
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
            .logo-img { width: 120px; height: auto; }
            
            .booking-header-info { text-align: right; }
            .label-sm { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
            .val-lg { font-size: 18px; font-weight: 800; color: #000; }
            .price-blue { color: #2563eb; font-size: 22px; font-weight: 800; }

            .section-tag { font-size: 11px; font-weight: 800; color: #10b981; margin: 25px 0 15px; text-transform: uppercase; }
            
            .pass-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; }
            .meta-box .val { font-size: 14px; font-weight: 700; color: #1e293b; display: block; }

            .route-card { background: #f8fafc; border-radius: 20px; padding: 25px; margin: 25px 0; display: flex; align-items: center; justify-content: space-between; }
            .apt-code { font-size: 32px; font-weight: 800; margin: 0; color: #0f172a; line-height: 1; }
            .apt-name { font-size: 11px; color: #64748b; font-weight: 500; }
            .flight-time { font-size: 16px; font-weight: 800; margin-top: 5px; }
            
            .path-area { flex: 1; text-align: center; position: relative; padding: 0 15px; }
            .line { border-top: 2px dashed #cbd5e1; position: absolute; top: 35%; left: 15px; right: 15px; }
            .plane { position: relative; z-index: 2; background: #f8fafc; padding: 0 8px; color: #2563eb; font-size: 12px; }
            .dur { font-size: 9px; font-weight: 800; color: #1e293b; margin-top: 15px; }

            /* Icon Grid - Labels BELOW Icons */
            .icon-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 30px 0; }
            .icon-item { display: flex; flex-direction: column; align-items: center; text-align: center; }
            .icon-circle { width: 36px; height: 36px; background: #eff6ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; color: #2563eb; }
            .icon-label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 2px; }
            .icon-val { font-size: 11px; font-weight: 700; color: #1e293b; }

            .info-card { background: #f8fafc; border-radius: 15px; padding: 20px; margin-top: 30px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .info-col h4 { font-size: 10px; font-weight: 800; margin: 0 0 10px 0; text-transform: uppercase; color: #475569; }
            .info-col ul { padding-left: 12px; margin: 0; }
            .info-col li { font-size: 10px; color: #64748b; margin-bottom: 5px; line-height: 1.4; }

            .footer-strip { margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 20px; display: flex; justify-content: space-between; align-items: center; }
            .support-text { font-size: 10px; color: #94a3b8; }
        </style>
    </head>
    <body>
        <div class="header">
            ${logoBase64 ? `<img src="${logoBase64}" class="logo-img">` : `<strong>KLAR TRAVELS</strong>`}
            <div class="booking-header-info">
                <div class="label-sm">Booking Reference</div>
                <div class="val-lg">${order.BookingId}</div>
                <div class="label-sm" style="margin-top: 8px;">Total Amount Paid</div>
                <div class="price-blue">₹${fare.NetFare?.toLocaleString('en-IN')}</div>
            </div>
        </div>

        <div class="section-tag">Passenger Information</div>
        <div class="pass-grid">
            <div class="meta-box"><span class="label-sm">Name</span><span class="val">${passenger.Title} ${passenger.FirstName} ${passenger.LastName}</span></div>
            <div class="meta-box"><span class="label-sm">PNR</span><span class="val">${pnr}</span></div>
            <div class="meta-box"><span class="label-sm">Ticket Type</span><span class="val">${passenger.FareDetails?.CabinClass} (${passenger.FareDetails?.ClassCode})</span></div>
        </div>

        ${segments.map((seg: any) => `
        <div class="route-card">
            <div class="apt-group">
                <div class="apt-code">${seg.DepartureAirport.cityCode}</div>
                <div class="apt-name">${seg.DepartureAirport.city}</div>
                <div class="flight-time">${new Date(seg.DepartureTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}</div>
                <div class="label-sm">${formatDate(seg.DepartureTime)}</div>
            </div>
            <div class="path-area">
                <div class="line"></div>
                <span class="plane">✈</span>
                <div class="dur">${seg.Duration} MINS • NON-STOP</div>
            </div>
            <div class="apt-group" style="text-align: right;">
                <div class="apt-code">${seg.ArrivalAirport.cityCode}</div>
                <div class="apt-name">${seg.ArrivalAirport.city}</div>
                <div class="flight-time">${new Date(seg.ArrivalTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}</div>
                <div class="label-sm">${formatDate(seg.ArrivalTime)}</div>
            </div>
        </div>
        `).join('')}

        <div class="icon-grid">
            <div class="icon-item">
                <div class="icon-circle">💺</div>
                <div class="icon-label">Seat</div>
                <div class="icon-val">Confirmed</div>
            </div>
            <div class="icon-item">
                <div class="icon-circle">🎒</div>
                <div class="icon-label">Baggage</div>
                <div class="icon-val">${passenger.FareDetails?.BaggageInfo?.CheckInBaggage || '15 Kg'}</div>
            </div>
            <div class="icon-item">
                <div class="icon-circle">🍽</div>
                <div class="icon-label">Meal</div>
                <div class="icon-val">${passenger.FareDetails?.MealIncluded ? 'Included' : 'Not Included'}</div>
            </div>
            <div class="icon-item">
                <div class="icon-circle">📊</div>
                <div class="icon-label">Class</div>
                <div class="icon-val">${passenger.FareDetails?.CabinClass}</div>
            </div>
        </div>

        <div class="info-card">
            <div class="info-grid">
                <div class="info-col">
                    <h4>Check-in & Boarding</h4>
                    <ul>
                        <li>Web check-in opens 48 hours prior to departure.</li>
                        <li>Counters close 60 minutes before departure.</li>
                        <li>Gates close 20 minutes before take-off.</li>
                    </ul>
                </div>
                <div class="info-col">
                    <h4>ID Requirements</h4>
                    <ul>
                        <li>Government photo ID is mandatory for travel.</li>
                        <li>Digital copies on DigiLocker are valid at all airports.</li>
                    </ul>
                </div>
            </div>
        </div>

        <div class="footer-strip">
            <div class="support-text">
                Need help? Contact support@klartravels.com | +91 1234567890
            </div>
            ${logoBase64 ? `<img src="${logoBase64}" style="width: 70px; opacity: 0.6;">` : ''}
        </div>
    </body>
    </html>
    `;
};