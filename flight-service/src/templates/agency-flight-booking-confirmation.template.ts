export const agencyFlightBookingConfirmationTemplate = (tripjackData: any, mongoData: any, logoBase64: string): string => {
    const order = tripjackData?.order || {};
    const air = tripjackData?.itemInfos?.AIR || {};
    const trip = air?.TripInformation?.[0] || {};
    const segments = trip?.SegmentInformation || [];
    const passenger = air?.TravellerInformation?.[0] || {};

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
            body { font-family: 'Inter', sans-serif; color: #1e293b; padding: 40px; margin: 0; background: white; }
            
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
            .logo-img { width: 130px; height: auto; }
            
            .booking-header-info { text-align: right; }
            .label-sm { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
            .val-lg { font-size: 20px; font-weight: 800; color: #000; }
            .price-blue { color: #1e40af; font-size: 24px; font-weight: 800; margin-top: 4px; }

            .badge-agency { background: #eff6ff; color: #1e40af; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; display: inline-block; margin-bottom: 8px; text-transform: uppercase; }
            .section-tag { font-size: 11px; font-weight: 800; color: #10b981; margin: 30px 0 10px; text-transform: uppercase; }
            
            .pass-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; border-top: 1px solid #f1f5f9; padding-top: 15px; }
            .meta-box .val { font-size: 15px; font-weight: 700; color: #1e293b; margin-top: 4px; display: block; }

            .route-card { background: #f8fafc; border-radius: 24px; padding: 30px; margin: 30px 0; display: flex; align-items: center; justify-content: space-between; }
            .apt-code { font-size: 42px; font-weight: 800; margin: 0; color: #0f172a; line-height: 1; }
            .apt-name { font-size: 12px; color: #1e293b; font-weight: 700; margin-top: 4px; }
            .flight-time { font-size: 18px; font-weight: 800; margin-top: 8px; }
            
            .path-area { flex: 1; text-align: center; position: relative; padding: 0 20px; }
            .line { border-top: 2px solid #cbd5e1; position: absolute; top: 35%; left: 20px; right: 20px; }
            .plane { position: relative; z-index: 2; background: #f8fafc; padding: 0 10px; color: #2563eb; font-size: 14px; }
            .dur { font-size: 10px; font-weight: 800; color: #1e293b; margin-top: 20px; text-transform: uppercase; }

            .icon-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px 50px; margin: 30px 0; }
            .icon-item { display: flex; align-items: center; gap: 15px; }
            .icon-circle { width: 42px; height: 42px; background: #eff6ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #2563eb; font-size: 16px; flex-shrink: 0; }
            .icon-text-group { display: flex; flex-direction: column; }
            .icon-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
            .icon-val { font-size: 15px; font-weight: 700; color: #1e293b; }

            /* Agency Earnings Table */
            .billing-table { width: 100%; border-collapse: collapse; margin-top: 25px; background: #f8fafc; border-radius: 16px; overflow: hidden; }
            .billing-table th { background: #f1f5f9; padding: 12px 16px; font-size: 11px; font-weight: 800; text-align: left; color: #475569; text-transform: uppercase; }
            .billing-table td { padding: 16px; font-size: 14px; font-weight: 700; border-bottom: 1px solid #edf2f7; color: #1e293b; }
            .total-row { background: #eff6ff; font-size: 16px !important; color: #1e40af !important; }

            .footer-branding { margin-top: 40px; text-align: right; }
            .footer-logo { width: 100px; filter: grayscale(1); opacity: 0.6; }
        </style>
    </head>
    <body>
        <div class="header">
            ${logoBase64 ? `<img src="${logoBase64}" class="logo-img">` : `<strong>KLAR TRAVELS</strong>`}
            <div class="booking-header-info">
                <span class="badge-agency">Agency Internal Copy</span>
                <div class="label-sm">Booking Reference</div>
                <div class="val-lg">${order.BookingId || mongoData?.bookingId}</div>
            </div>
        </div>

        <div class="section-tag">Passenger & Agent Details</div>
        <div class="pass-grid">
            <div class="meta-box"><span class="label-sm">Lead Passenger</span><span class="val">${passenger.Title || mongoData?.travellers?.[0]?.title} ${passenger.FirstName || mongoData?.travellers?.[0]?.firstName} ${passenger.LastName || mongoData?.travellers?.[0]?.lastName}</span></div>
            <div class="meta-box"><span class="label-sm">PNR</span><span class="val">${pnr}</span></div>
            <div class="meta-box"><span class="label-sm">Agent Account / Role</span><span class="val">${mongoData?.userInfo?.email} (${mongoData?.userInfo?.role})</span></div>
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
                <div class="icon-text-group">
                    <div class="icon-label">Seat Assignment</div>
                    <div class="icon-val">Confirmed</div>
                </div>
            </div>
            <div class="icon-item">
                <div class="icon-circle">🎒</div>
                <div class="icon-text-group">
                    <div class="icon-label">Baggage Allowance</div>
                    <div class="icon-val">${passenger.FareDetails?.BaggageInfo?.CheckInBaggage || '15 Kg'}</div>
                </div>
            </div>
        </div>

        <div class="section-tag">Fare Breakup & Dynamic Markup (B2B)</div>
        <table class="billing-table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Amount (INR)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Tripjack Provider Net Fare</td>
                    <td>₹${(mongoData?.tripjackPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                    <td>Agency Applied Markup Configuration</td>
                    <td style="color: #10b981;">+ ₹${(mongoData?.markupPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr class="total-row">
                    <td>Total Gross Payable Amount</td>
                    <td>₹${(mongoData?.totalPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
            </tbody>
        </table>

        <div class="footer-branding">
            ${logoBase64 ? `<img src="${logoBase64}" class="footer-logo">` : ''}
        </div>
    </body>
    </html>
    `;
};