import React from "react";
import ReactDOMServer from "react-dom/server";

export interface HotelEmailTemplateProps {
  booking: any;
  status: "CONFIRMED" | "CANCELLED" | "PENDING" | "FAILED" | "HELD" | string;
  target: "client" | "agent";
  logoDataUri?: string;
}

export const HotelEmailTemplate: React.FC<HotelEmailTemplateProps> = ({
  booking,
  status,
  target,
  logoDataUri,
}) => {
  const rawStatus = String(status || "").toUpperCase();

  let displayStatus = rawStatus;
  let statusColor = "#10b981"; // Green for confirmed
  if (rawStatus === "CANCELLED" || rawStatus === "CANCELLATION_PENDING") {
    displayStatus = "CANCELLED";
    statusColor = "#f87171";
  } else if (rawStatus === "HELD") {
    displayStatus = "ON HOLD";
    statusColor = "#fbbf24";
  } else if (rawStatus === "FAILED") {
    displayStatus = "FAILED";
    statusColor = "#9ca3af";
  } else if (
    rawStatus === "PENDING" ||
    rawStatus === "SUPPLIER_PENDING" ||
    rawStatus === "MANUAL_REVIEW"
  ) {
    displayStatus = "PENDING";
    statusColor = "#4f46e5"; // Indigo for pending
  }

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (val: number) => {
    return `₹${Number(val || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const clientEmail =
    booking.guestEmail ||
    booking.tripJackRequest?.deliveryInfo?.emails?.[0] ||
    "N/A";

  let clientPhone = booking.guestMobile || "N/A";
  if (booking.tripJackRequest?.deliveryInfo?.contacts?.[0]) {
    clientPhone = booking.tripJackRequest.deliveryInfo.contacts[0];
  }

  const roomName =
    booking.roomType ||
    booking.rooms?.[0]?.roomType ||
    booking.roomName ||
    "Standard Room";

  const roomsCount =
    booking.rooms?.length || booking.tripJackRequest?.roomInfo?.length || 1;

  let mealPlan = "Room Only";
  if (booking.rooms?.[0]?.boardType) mealPlan = booking.rooms[0].boardType;

  const checkInDate =
    booking.checkIn || booking.tripJackRequest?.searchQuery?.checkInDate;
  const checkOutDate =
    booking.checkOut || booking.tripJackRequest?.searchQuery?.checkOutDate;
  const hotelName = booking.hotelName || "Your Selected Hotel";

  // Financials
  const totalAmount = Number(booking.totalAmount || 0);
  const netAmount = Number(booking.netAmount || 0);

  // Passengers
  const passengerName = String(booking.guestName || "Guest").toUpperCase();

  const hotelImageUrl = booking.hotelImage;

  let taxesForDisplay = 0;
  let baseFareForDisplay = totalAmount;

  if (booking.taxes) {
    taxesForDisplay = Number(booking.taxes);
    baseFareForDisplay = totalAmount - taxesForDisplay;
  } else if (Number(booking.markupAmount) > 0) {
    taxesForDisplay = Number(booking.markupAmount);
    baseFareForDisplay = totalAmount - taxesForDisplay;
  }

  let amenities: string[] = [];
  if (Array.isArray(booking.amenities)) {
    amenities = booking.amenities;
  } else if (booking.rooms?.[0]?.amenities) {
    amenities = booking.rooms[0].amenities;
  } else if (
    booking.tripJackRequest?.roomTravellerInfo?.[0]?.roomInfo?.amenities
  ) {
    const am = booking.tripJackRequest.roomTravellerInfo[0].roomInfo.amenities;
    if (Array.isArray(am)) amenities = am;
    else if (typeof am === "string")
      amenities = am.split(",").map((a: string) => a.trim());
  }

  amenities = Array.isArray(amenities)
    ? amenities.filter((a) => typeof a === "string").slice(0, 6)
    : [];

  const css = `
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f1f5f9;
      color: #334155;
    }
    .wrapper {
      max-width: 650px;
      margin: 0 auto;
    }
    .container {
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 25px rgba(0,0,0,0.08);
    }
    .header {
      background: #0f172a;
      color: #fff;
      padding: 28px;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .header p {
      margin: 8px 0 0;
      font-size: 14px;
      color: #cbd5e1;
    }
    .section {
      padding: 24px 28px;
      border-bottom: 1px solid #e5e7eb;
    }
    .title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 16px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
    }
    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
    }
    .label {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 6px;
    }
    .value {
      font-size: 15px;
      font-weight: 600;
    }
    .hotel-box {
      border: 1px solid #dbeafe;
      background: #eff6ff;
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 18px;
    }
    .hotel-top {
      font-size: 16px;
      font-weight: 700;
      color: #1d4ed8;
      margin-bottom: 12px;
    }
    .hotel-img {
      width: 100%;
      height: 180px;
      object-fit: cover;
      border-radius: 14px 14px 0 0;
      display: block;
    }
    .hotel-content {
      padding: 18px;
    }
    .amenities {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px dashed #bfdbfe;
      font-size: 13px;
      color: #475569;
    }
    .amenity-tag {
      display: inline-block;
      background: #e0f2fe;
      color: #0369a1;
      padding: 4px 8px;
      border-radius: 4px;
      margin: 0 6px 6px 0;
      font-size: 11px;
      font-weight: 600;
    }
    .route {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }
    .airport {
      flex: 1;
      min-width: 120px;
    }
    .code {
      font-size: 20px;
      font-weight: 800;
    }
    .city {
      font-size: 13px;
      color: #475569;
      margin-top: 4px;
    }
    .center {
      text-align: center;
      min-width: 100px;
    }
    .line {
      font-size: 13px;
      color: #475569;
      margin-bottom: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    td {
      padding: 8px 0;
      font-size: 14px;
    }
    td:last-child {
      text-align: right;
      font-weight: 600;
    }
    .grand td {
      border-top: 1px solid #d1d5db;
      padding-top: 12px;
    }
    .footer {
      text-align: center;
      padding: 20px;
      font-size: 13px;
      color: #94a3b8;
    }
    .agent-ribbon {
      background: #1f2937;
      color: #10b981;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      padding: 8px 24px;
      text-align: center;
    }
    @media (max-width: 600px) {
      .grid { grid-template-columns: 1fr; }
      .route { flex-direction: column !important; align-items: flex-start !important; gap: 15px !important; }
      .center { width: 100% !important; border-left: 2px dashed #94a3b8; padding-left: 15px; margin: 5px 0 5px 15px !important; text-align: left !important; }
      .airport { text-align: left !important; }
      .wrapper { padding: 10px; width: 100%; box-sizing: border-box; }
    }
  `;

  return (
    <html>
      <head>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <div className="wrapper">
          <div className="container">
            {target === "agent" && (
              <div className="agent-ribbon">
                Internal Agent Ledger | Agent ID: {booking.agentId || "N/A"}
              </div>
            )}
            <div className="header">
              {logoDataUri && (
                <img
                  src={logoDataUri}
                  alt="Logo"
                  style={{ height: "40px", marginBottom: "15px" }}
                />
              )}
              <h1>Hotel Booking {displayStatus}</h1>
              <p>Your hotel reservation has been received successfully.</p>
            </div>

            <div className="section">
              <div className="title">Booking Details</div>
              <div className="grid">
                <div className="card">
                  <div className="label">Booking ID</div>
                  <div className="value">
                    {booking.klarBookingId || booking.confirmationNumber || "-"}
                  </div>
                </div>
                <div className="card">
                  <div className="label">Booking Status</div>
                  <div className="value" style={{ color: statusColor }}>
                    {displayStatus}
                  </div>
                </div>
                <div className="card">
                  <div className="label">Booking Date</div>
                  <div className="value">{formatDate(booking.createdAt)}</div>
                </div>
                <div className="card">
                  <div className="label">Amount Paid</div>
                  <div className="value">{formatCurrency(totalAmount)}</div>
                </div>
              </div>
            </div>

            <div className="section">
              <div className="title">Guest Information</div>
              <div className="grid">
                <div className="card">
                  <div className="label">Guest Name</div>
                  <div className="value">{passengerName}</div>
                </div>
                <div className="card">
                  <div className="label">Contact Email</div>
                  <div className="value">{clientEmail}</div>
                </div>
                <div className="card">
                  <div className="label">Contact Phone</div>
                  <div className="value">{clientPhone}</div>
                </div>
              </div>
            </div>

            <div className="section">
              <div className="title">Stay Details</div>
              <div
                className="hotel-box"
                style={{ padding: 0, overflow: "hidden" }}
              >
                {hotelImageUrl && (
                  <img src={hotelImageUrl} alt="Hotel" className="hotel-img" />
                )}
                <div className="hotel-content">
                  <div className="hotel-top">{hotelName}</div>
                  <div className="route">
                    <div className="airport">
                      <div className="code">CHECK-IN</div>
                      <div className="city">{formatDate(checkInDate)}</div>
                    </div>
                    <div className="center">
                      <div className="line">{roomsCount} Room(s)</div>
                      <div className="line" style={{ fontWeight: 600 }}>
                        🛏️ {roomName}
                      </div>
                      <div className="line" style={{ marginTop: "4px" }}>
                        🍽️ {mealPlan}
                      </div>
                    </div>
                    <div className="airport" style={{ textAlign: "right" }}>
                      <div className="code">CHECK-OUT</div>
                      <div className="city">{formatDate(checkOutDate)}</div>
                    </div>
                  </div>
                  {amenities.length > 0 && (
                    <div className="amenities">
                      <strong>Included Amenities:</strong>
                      <br />
                      <div style={{ marginTop: "8px" }}>
                        {amenities.map((am, i) => (
                          <span key={i} className="amenity-tag">
                            ✓ {am}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="section">
              <div className="title">Fare Summary</div>
              <table>
                <tbody>
                  <tr>
                    <td>Base Fare (1 Room)</td>
                    <td>{formatCurrency(baseFareForDisplay)}</td>
                  </tr>
                  <tr>
                    <td>Taxes & Fees</td>
                    <td>
                      {taxesForDisplay > 0
                        ? formatCurrency(taxesForDisplay)
                        : "Included"}
                    </td>
                  </tr>
                  {target === "agent" && (
                    <tr>
                      <td>Net Rate (Agent)</td>
                      <td>{formatCurrency(netAmount)}</td>
                    </tr>
                  )}
                  <tr className="grand">
                    <td>Total Paid</td>
                    <td>{formatCurrency(totalAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="footer">
              Thank you for booking with Klar Travels. Wishing you a pleasant
              stay.
            </div>
          </div>
        </div>
      </body>
    </html>
  );
};

export const compileReactHtml = (
  target: "client" | "agent",
  booking: any,
  status: string,
  logoDataUri?: string,
): string => {
  return ReactDOMServer.renderToStaticMarkup(
    <HotelEmailTemplate
      booking={booking}
      status={status}
      target={target}
      logoDataUri={logoDataUri}
    />,
  );
};
