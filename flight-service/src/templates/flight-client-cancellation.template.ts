export const flightClientCancellationTemplate = (data: any, logoBase64: string): string => {
    const order = data?.order || {};
    const air = data?.itemInfos?.AIR || {};
    const trip = air?.TripInformation?.[0] || {};
    const segments = trip?.SegmentInformation || [];
    
    // Fallback extraction chain matching your database object topology
    const passenger = air?.TravellerInformation?.[0] || data?.travellers?.[0] || {};
    const fare = air?.totalPriceInfo?.totalFareDetail?.FareComponents || {};

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

    // PNR Safe extraction mechanics
    let resolvedPnr = 'N/A';
    if (passenger?.pnrDetails && Object.keys(passenger.pnrDetails).length > 0) {
        resolvedPnr = Object.values(passenger.pnrDetails)[0] as string;
    } else if (passenger?.pnr) {
        resolvedPnr = passenger.pnr;
    } else if (data?.pnr) {
        resolvedPnr = data.pnr;
    } else if (order?.Pnr || order?.pnr) {
        resolvedPnr = order.Pnr || order.pnr;
    } else if (segments.length > 0) {
        for (const seg of segments) {
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

    const title = passenger.Title || passenger.title || 'Mr/Ms';
    const firstName = passenger.FirstName || passenger.firstName || '';
    const lastName = passenger.LastName || passenger.lastName || '';
    const cabinClass = passenger.FareDetails?.CabinClass || passenger.paxType || 'ECONOMY';
    const classCode = passenger.FareDetails?.ClassCode || 'T';

    const netFareAmount = fare.NetFare || data.totalPrice || order.Amount || 0;

    return `
    <html>
    <head>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            body { font-family: 'Inter', sans-serif; color: #1e293b; padding: 40px; margin: 0; background: white; position: relative; }
            
            /* Watermark design directly matching uploaded schematic positioning layout */
            .watermark-container { position: absolute; top: 10px; left: 45%; width: 320px; text-align: center; overflow: hidden; pointer-events: none; z-index: 10; }
            .watermark-text { font-size: 38px; font-weight: 900; color: rgba(239, 68, 68, 0.14); border: 4px solid rgba(239, 68, 68, 0.25); padding: 8px 18px; border-radius: 12px; text-transform: uppercase; display: inline-block; transform: rotate(-14deg); letter-spacing: 3px; }

            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; position: relative; z-index: 1; }
            .logo-img { width: 130px; height: auto; }
            
            .booking-header-info { text-align: right; }
            .label-sm { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
            .val-lg { font-size: 20px; font-weight: 800; color: #000; }
            .price-crossed { color: #94a3b8; font-size: 22px; font-weight: 800; margin-top: 4px; text-decoration: line-through; }

            /* Structural Tag updated to match soft warning crimson variant */
            .section-tag { font-size: 11px; font-weight: 800; color: #b91c1c; margin: 30px 0 10px; text-transform: uppercase; letter-spacing: 0.3px; }
            
            .pass-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; border-top: 1px solid #f1f5f9; padding-top: 15px; }
            .meta-box .val { font-size: 15px; font-weight: 700; color: #1e293b; margin-top: 4px; display: block; }

            /* Notice Box styled to display Booking Invalidation Warnings */
            .invalidation-notice-card { border: 2px solid #fca5a5; background: #fff5f5; border-radius: 20px; padding: 22px 26px; margin: 30px 0; display: flex; align-items: flex-start; gap: 16px; }
            .invalidation-icon { font-size: 20px; color: #ef4444; line-height: 1; margin-top: 2px; }
            .invalidation-content h3 { font-size: 14px; font-weight: 800; color: #991b1b; margin: 0 0 6px 0; text-transform: capitalize; }
            .invalidation-content p { font-size: 11.5px; line-height: 1.6; color: #7f1d1d; margin: 0; font-weight: 500; }

            .route-card { background: #f8fafc; border-radius: 24px; padding: 30px; margin: 25px 0; display: flex; align-items: center; justify-content: space-between; opacity: 0.75; border-left: 4px solid #cbd5e1; }
            .apt-code { font-size: 42px; font-weight: 800; margin: 0; color: #475569; line-height: 1; }
            .apt-name { font-size: 12px; color: #475569; font-weight: 700; margin-top: 4px; }
            .flight-time { font-size: 18px; font-weight: 800; color: #64748b; margin-top: 8px; }
            
            .path-area { flex: 1; text-align: center; position: relative; padding: 0 20px; }
            .line { border-top: 2px dashed #cbd5e1; position: absolute; top: 35%; left: 20px; right: 20px; }
            .plane { position: relative; z-index: 2; background: #f8fafc; padding: 0 10px; color: #94a3b8; font-size: 14px; }
            .dur { font-size: 10px; font-weight: 800; color: #64748b; margin-top: 20px; text-transform: uppercase; }

            .icon-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px 50px; margin: 35px 0; opacity: 0.8; }
            .icon-item { display: flex; align-items: center; gap: 15px; }
            .icon-circle { width: 42px; height: 42px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 16px; flex-shrink: 0; }
            .icon-text-group { display: flex; flex-direction: column; }
            .icon-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
            .icon-val { font-size: 15px; font-weight: 700; color: #475569; }

            .info-card { background: #f8fafc; border-radius: 20px; padding: 25px; margin-top: 40px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .info-col h4 { font-size: 11px; font-weight: 800; margin: 0 0 12px 0; text-transform: uppercase; color: #1e293b; display: flex; align-items: center; gap: 8px; }
            .info-col ul { padding-left: 15px; margin: 0; }
            .info-col li { font-size: 11px; color: #475569; margin-bottom: 8px; line-height: 1.5; font-weight: 500; }

            .footer-branding { margin-top: 60px; text-align: right; }
            .footer-logo { width: 100px; opacity: 0.6; }
        </style>
    </head>
    <body>
        <div class="watermark-container">
            <div class="watermark-text">Cancelled</div>
        </div>

        <div class="header">
            ${logoBase64 ? `<img src="${logoBase64}" class="logo-img">` : `<strong>KLAR TRAVELS</strong>`}
            <div class="booking-header-info">
                <div class="label-sm">Booking Reference</div>
                <div class="val-lg">${data.bookingId || order.BookingId || 'N/A'}</div>
                <div class="label-sm" style="margin-top: 10px;">Original Amount Paid</div>
                <div class="price-crossed">₹${netFareAmount.toLocaleString('en-IN')}</div>
            </div>
        </div>

        <div class="section-tag">Flight Cancellation</div>

        <div class="invalidation-notice-card">
            <div class="invalidation-icon">🚫</div>
            <div class="invalidation-content">
                <h3>Booking Invalidation Notice</h3>
                <p>This document serves as formal confirmation that the booking referenced above has been successfully cancelled at the passenger's request. All travel segments associated with this PNR are no longer valid for travel.</p>
            </div>
        </div>

        <div class="label-sm" style="margin-bottom: 5px;">Passenger Information</div>
        <div class="pass-grid">
            <div class="meta-box"><span class="label-sm">Name</span><span class="val">${title} ${firstName} ${lastName}</span></div>
            <div class="meta-box"><span class="label-sm">PNR</span><span class="val" style="color: #ef4444; text-decoration: line-through;">${resolvedPnr}</span></div>
            <div class="meta-box"><span class="label-sm">Ticket Type</span><span class="val">${cabinClass} (${classCode})</span></div>
        </div>

        ${segments.map((seg: any) => `
        <div class="route-card">
            <div class="apt-group">
                <div class="apt-code">${seg.DepartureAirport?.cityCode || 'N/A'}</div>
                <div class="apt-name">${seg.DepartureAirport?.city || 'N/A'}</div>
                <div class="flight-time">${seg.DepartureTime ? new Date(seg.DepartureTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}) : '00:00'}</div>
                <div class="label-sm">${formatDate(seg.DepartureTime)}</div>
            </div>
            <div class="path-area">
                <div class="line"></div>
                <span class="plane">✈</span>
                <div class="dur">${formatDuration(seg.Duration)} • CANCELLED</div>
            </div>
            <div class="apt-group" style="text-align: right;">
                <div class="apt-code">${seg.ArrivalAirport?.cityCode || 'N/A'}</div>
                <div class="apt-name">${seg.ArrivalAirport?.city || 'N/A'}</div>
                <div class="flight-time">${seg.ArrivalTime ? new Date(seg.ArrivalTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}) : '00:00'}</div>
                <div class="label-sm">${formatDate(seg.ArrivalTime)}</div>
            </div>
        </div>
        `).join('')}

        <div class="icon-grid">
            <div class="icon-item">
                <div class="icon-circle">💺</div>
                <div class="icon-text-group">
                    <div class="icon-label">Seat Assignment</div>
                    <div class="icon-val" style="color: #ef4444;">Voided</div>
                </div>
            </div>
            <div class="icon-item">
                <div class="icon-circle">🎒</div>
                <div class="icon-text-group">
                    <div class="icon-label">Baggage Allowance</div>
                    <div class="icon-val">0 Kg (Cancelled)</div>
                </div>
            </div>
            <div class="icon-item">
                <div class="icon-circle">🍽</div>
                <div class="icon-text-group">
                    <div class="icon-label">Meal Preference</div>
                    <div class="icon-val">Withdrawn</div>
                </div>
            </div>
            <div class="icon-item">
                <div class="icon-circle">📊</div>
                <div class="icon-text-group">
                    <div class="icon-label">Booking Status</div>
                    <div class="icon-val" style="color: #b91c1c; font-weight: 800;">CANCELLED</div>
                </div>
            </div>
        </div>

        <div class="info-card">
            <div class="info-grid">
                <div class="info-col">
                    <h4>ⓘ Refund Information</h4>
                    <ul>
                        <li>Refund processing timelines depend on the underlying carrier's terms.</li>
                        <li>Approved refunds are normally directly credited back to the original form of payment.</li>
                        <li>Please retain this cancellation confirmation copy for documentation or travel insurance claims.</li>
                    </ul>
                </div>
                <div class="info-col">
                    <h4>Support & Inquiries</h4>
                    <ul>
                        <li>For voluntary rebooking rules, please check airline guidelines.</li>
                        <li>Ancillary service fees collected by ground services might be non-refundable.</li>
                        <li>For more queries regarding your transaction, reach out to support helpdesk.</li>
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