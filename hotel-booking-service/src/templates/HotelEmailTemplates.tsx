import React from "react";

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
  logoDataUri
}) => {
  const rawStatus = String(status || "").toUpperCase();

  // Normalize status for presentation
  let displayStatus = rawStatus;
  let headerGradient = "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"; // Indigo (Pending/Default)
  let statusBadgeColor = "#e0e7ff";
  let statusTextColor = "#4f46e5";

  if (rawStatus === "CONFIRMED") {
    displayStatus = "CONFIRMED";
    headerGradient = "linear-gradient(135deg, #10b981 0%, #059669 100%)"; // Green
    statusBadgeColor = "#d1fae5";
    statusTextColor = "#065f46";
  } else if (rawStatus === "CANCELLED" || rawStatus === "CANCELLATION_PENDING") {
    displayStatus = rawStatus === "CANCELLATION_PENDING" ? "CANCEL PENDING" : "CANCELLED";
    headerGradient = "linear-gradient(135deg, #f87171 0%, #dc2626 100%)"; // Red
    statusBadgeColor = "#fee2e2";
    statusTextColor = "#991b1b";
  } else if (rawStatus === "HELD") {
    displayStatus = "ON HOLD";
    headerGradient = "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)"; // Amber/Orange
    statusBadgeColor = "#fef3c7";
    statusTextColor = "#92400e";
  } else if (rawStatus === "FAILED") {
    displayStatus = "FAILED";
    headerGradient = "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)"; // Gray
    statusBadgeColor = "#f3f4f6";
    statusTextColor = "#374151";
  }

  // --- Date Formatter Helpers ---
  const formatDate = (dateStr: any) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  const formatTime = (dateStr: any) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  };

  // --- Dynamic Extractions ---
  const clientEmail =
    booking.guestEmail ||
    booking.tripJackRequest?.deliveryInfo?.emails?.[0] ||
    "N/A";

  let clientPhone = "N/A";
  if (booking.guestMobile) {
    clientPhone = booking.guestMobile.trim().startsWith("+91")
      ? booking.guestMobile
      : `+91 ${booking.guestMobile}`;
  } else if (booking.tripJackRequest?.deliveryInfo?.contacts?.[0]) {
    const countryCode = booking.tripJackRequest?.deliveryInfo?.code?.[0] || "";
    clientPhone = `${countryCode} ${booking.tripJackRequest.deliveryInfo.contacts[0]}`.trim();
  }

  const roomName =
    booking.roomType ||
    booking.rooms?.[0]?.roomType ||
    booking.roomName ||
    "Deluxe Room";

  const roomsCount =
    booking.rooms?.length || booking.tripJackRequest?.roomInfo?.length || 1;

  let mealPlan = "Room Only";
  if (booking.rooms?.[0]?.boardType && booking.rooms[0].boardType.trim() !== "") {
    mealPlan = booking.rooms[0].boardType;
  } else if (booking.tripJackRequest?.ops?.[0]?.ris?.[0]?.mb) {
    mealPlan = booking.tripJackRequest.ops[0].ris[0].mb;
  } else if (booking.tripJackRequest?.ops?.[0]?.mb) {
    mealPlan = booking.tripJackRequest.ops[0].mb;
  }

  // Meta Date
  let metaDateLabel = "Booked On";
  let metaDateValue = booking.createdAt
    ? `${formatDate(booking.createdAt)}, ${formatTime(booking.createdAt)}`
    : "N/A";

  if (rawStatus === "CANCELLED") {
    metaDateLabel = "Cancelled On";
    metaDateValue = booking.updatedAt
      ? `${formatDate(booking.updatedAt)}, ${formatTime(booking.updatedAt)}`
      : "N/A";
  }

  // Financial Calculations
  const totalAmount = Number(booking.totalAmount || 0);
  const netAmount = Number(booking.netAmount || 0);
  const markupAmount = Number(booking.markupAmount || 0);
  const currencyCode = booking.currencyCode || "INR";

  const cancellationPenaltyVal =
    booking.cancelCharge !== undefined
      ? Number(booking.cancelCharge)
      : booking.cancellationDetails?.penalties?.[0]?.amount !== undefined
      ? Number(booking.cancellationDetails.penalties[0].amount)
      : 0;

  const refundAmountVal = Math.max(0, totalAmount - cancellationPenaltyVal);

  const formatCurrency = (val: number) => {
    return val.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Passenger Rows Extraction
  let passengers: any[] = [];
  if (booking.tripJackRequest?.roomTravellerInfo) {
    booking.tripJackRequest.roomTravellerInfo.forEach((room: any, rIndex: number) => {
      if (room.travellerInfo) {
        room.travellerInfo.forEach((pax: any, pIndex: number) => {
          passengers.push({
            roomIndex: rIndex + 1,
            guestIndex: pIndex + 1,
            name: `${pax.ti || ""} ${pax.fN || ""} ${pax.lN || ""}`.trim().toUpperCase(),
            type: String(pax.pt || "ADULT").toUpperCase(),
            docInfo: pax.pNum ? `Passport: ${pax.pNum}` : "N/A"
          });
        });
      }
    });
  } else {
    const totalGuestsCount = booking.rooms?.[0]?.guests || 1;
    for (let i = 0; i < totalGuestsCount; i++) {
      passengers.push({
        roomIndex: 1,
        guestIndex: i + 1,
        name: i === 0 ? String(booking.guestName || "Guest").toUpperCase() : `GUEST COMPANION ${i + 1}`,
        type: "ADULT",
        docInfo: "N/A"
      });
    }
  }

  return (
    <div
      style={{
        fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif",
        backgroundColor: "#f4f6f8",
        margin: 0,
        padding: "20px 10px",
        color: "#1f2937",
        lineHeight: "1.6"
      }}
    >
      <table
        align="center"
        cellPadding="0"
        cellSpacing="0"
        width="100%"
        style={{
          maxWidth: "650px",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
          borderCollapse: "collapse"
        }}
      >
        {/* Ribbon for B2B Agent Ledger */}
        {target === "agent" && (
          <tr>
            <td
              style={{
                backgroundColor: "#1f2937",
                color: "#10b981",
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                padding: "8px 24px",
                textAlign: "left"
              }}
            >
              <table width="100%" cellPadding="0" cellSpacing="0">
                <tr>
                  <td>Internal Agent Ledger</td>
                  <td align="right">Agent ID: {booking.agentId || "N/A"}</td>
                </tr>
              </table>
            </td>
          </tr>
        )}

        {/* Dynamic Gradient Header */}
        <tr>
          <td
            style={{
              background: headerGradient,
              padding: "35px 30px",
              textAlign: "center",
              color: "#ffffff"
            }}
          >
            {logoDataUri ? (
              <img
                src={logoDataUri}
                alt="Klar Travels Logo"
                style={{ height: "45px", marginBottom: "15px", display: "inline-block" }}
              />
            ) : (
              <h2 style={{ margin: "0 0 10px", fontWeight: 800, letterSpacing: "1px", color: "#ffffff" }}>
                KLAR TRAVELS
              </h2>
            )}
            <h1
              style={{
                margin: 0,
                fontSize: "26px",
                fontWeight: 800,
                letterSpacing: "-0.5px"
              }}
            >
              {rawStatus === "CONFIRMED"
                ? "Hotel Booking Confirmed! 🎉"
                : rawStatus === "CANCELLED"
                ? "Hotel Booking Cancelled 🚫"
                : rawStatus === "HELD"
                ? "Hotel Booking On Hold ⏸️"
                : rawStatus === "FAILED"
                ? "Hotel Booking Failed ❌"
                : "Hotel Booking Placed 📝"}
            </h1>
            <p style={{ margin: "8px 0 0", fontSize: "14px", opacity: 0.9 }}>
              {rawStatus === "CONFIRMED"
                ? "Your reservation at the hotel has been successfully secured."
                : rawStatus === "CANCELLED"
                ? "Your booking has been cancelled and refund process initiated."
                : rawStatus === "HELD"
                ? "Your reservation is currently held. Please complete any outstanding action."
                : rawStatus === "FAILED"
                ? "We could not complete your booking. A full refund is initiated."
                : "Your booking is currently being processed with the hotel."}
            </p>
          </td>
        </tr>

        {/* Content Area */}
        <tr>
          <td style={{ padding: "30px" }}>
            {/* Greeting */}
            <p style={{ margin: "0 0 20px", fontSize: "16px", color: "#374151" }}>
              Dear <strong>{String(booking.guestName || "Valued Guest").toUpperCase()}</strong>,
            </p>
            <p style={{ margin: "0 0 25px", fontSize: "14px", color: "#4b5563" }}>
              {rawStatus === "CONFIRMED" &&
                "Your hotel reservation is confirmed. Please present this document during check-in."}
              {rawStatus === "PENDING" &&
                "We have received your booking request and payment. We are confirming availability with the hotel and will share your confirmation voucher shortly."}
              {rawStatus === "HELD" &&
                "Your hotel booking is placed on hold. Please check your dashboard for further updates."}
              {rawStatus === "CANCELLED" &&
                "We confirm that your reservation has been cancelled. Details of cancellation charges and refunds are outlined below."}
              {rawStatus === "FAILED" &&
                "Unfortunately, the hotel was unable to confirm your room. We have automatically triggered a full refund to your account."}
            </p>

            {/* Info Grid (Billed To & Service Details) */}
            <table width="100%" cellPadding="0" cellSpacing="0" style={{ marginBottom: "25px" }}>
              <tr>
                <td width="48%" valign="top">
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "16px",
                      backgroundColor: "#f9fafb",
                      minHeight: "130px"
                    }}
                  >
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.5px" }}>
                      👤 Billed To
                    </div>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: "#1f2937", marginBottom: "4px" }}>
                      {String(booking.guestName || "Guest").toUpperCase()}
                    </div>
                    <div style={{ fontSize: "13px", color: "#4b5563" }}>{clientEmail}</div>
                    <div style={{ fontSize: "13px", color: "#4b5563" }}>{clientPhone}</div>
                  </div>
                </td>
                <td width="4%"></td>
                <td width="48%" valign="top">
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "16px",
                      backgroundColor: "#f9fafb",
                      minHeight: "130px"
                    }}
                  >
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.5px" }}>
                      🏨 Hotel / Stay Info
                    </div>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: "#1f2937", marginBottom: "4px" }}>
                      {booking.hotelName || "Your Selected Hotel"}
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b7280", lineHeight: "1.4" }}>
                      {booking.hotelAddress || ""}
                    </div>
                  </div>
                </td>
              </tr>
            </table>

            {/* Reservation Overview Section */}
            <h3
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#1f2937",
                textTransform: "uppercase",
                letterSpacing: "1px",
                borderBottom: "2px solid #e5e7eb",
                paddingBottom: "8px",
                margin: "0 0 15px"
              }}
            >
              📋 Reservation Summary
            </h3>
            <table
              width="100%"
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                overflow: "hidden",
                borderCollapse: "separate",
                marginBottom: "25px",
                backgroundColor: "#ffffff"
              }}
            >
              <tr>
                <td style={{ padding: "12px 16px", fontSize: "13px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f9fafb", fontWeight: 600 }} width="40%">
                  Confirmation Number
                </td>
                <td style={{ padding: "12px 16px", fontSize: "13px", borderBottom: "1px solid #e2e8f0" }}>
                  <strong>{booking.confirmationNumber || "PENDING"}</strong>
                </td>
              </tr>
              {booking.hotelConfirmationNumber && (
                <tr>
                  <td style={{ padding: "12px 16px", fontSize: "13px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f9fafb", fontWeight: 600 }}>
                    Hotel Confirmation #
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", borderBottom: "1px solid #e2e8f0" }}>
                    <strong>{booking.hotelConfirmationNumber}</strong>
                  </td>
                </tr>
              )}
              <tr>
                <td style={{ padding: "12px 16px", fontSize: "13px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f9fafb", fontWeight: 600 }}>
                  {metaDateLabel}
                </td>
                <td style={{ padding: "12px 16px", fontSize: "13px", borderBottom: "1px solid #e2e8f0" }}>
                  {metaDateValue}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "12px 16px", fontSize: "13px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f9fafb", fontWeight: 600 }}>
                  Check-In Date
                </td>
                <td style={{ padding: "12px 16px", fontSize: "13px", borderBottom: "1px solid #e2e8f0" }}>
                  <strong>{formatDate(booking.checkIn)}</strong> (Standard policies apply)
                </td>
              </tr>
              <tr>
                <td style={{ padding: "12px 16px", fontSize: "13px", backgroundColor: "#f9fafb", fontWeight: 600 }}>
                  Check-Out Date
                </td>
                <td style={{ padding: "12px 16px", fontSize: "13px" }}>
                  <strong>{formatDate(booking.checkOut)}</strong>
                </td>
              </tr>
            </table>

            {/* Accommodation Table */}
            <h3
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#1f2937",
                textTransform: "uppercase",
                letterSpacing: "1px",
                borderBottom: "2px solid #e5e7eb",
                paddingBottom: "8px",
                margin: "0 0 15px"
              }}
            >
              🛏️ Inventory Details
            </h3>
            <table
              width="100%"
              cellPadding="0"
              cellSpacing="0"
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                overflow: "hidden",
                borderCollapse: "separate",
                marginBottom: "25px"
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#4f46e5", color: "#ffffff" }}>
                  <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 700, textAlign: "left", textTransform: "uppercase" }}>
                    Room Category
                  </th>
                  <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 700, textAlign: "center", textTransform: "uppercase", width: "20%" }}>
                    Rooms
                  </th>
                  <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 700, textAlign: "right", textTransform: "uppercase", width: "35%" }}>
                    Meal Plan
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151" }}>
                    {roomName}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "13px", textAlign: "center", color: "#374151" }}>
                    {roomsCount}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "13px", textAlign: "right", color: "#374151" }}>
                    {mealPlan}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Guest / Passengers Table (If more than 1 passenger) */}
            {passengers.length > 1 && (
              <>
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#1f2937",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    borderBottom: "2px solid #e5e7eb",
                    paddingBottom: "8px",
                    margin: "25px 0 15px"
                  }}
                >
                  👥 Guest Allocation Details
                </h3>
                <table
                  width="100%"
                  cellPadding="0"
                  cellSpacing="0"
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    overflow: "hidden",
                    borderCollapse: "separate",
                    marginBottom: "25px"
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f3f4f6", color: "#374151" }}>
                      <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, textAlign: "left", textTransform: "uppercase" }}>
                        Allocation
                      </th>
                      <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, textAlign: "left", textTransform: "uppercase" }}>
                        Full Name
                      </th>
                      <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: 700, textAlign: "center", textTransform: "uppercase", width: "15%" }}>
                        Type
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {passengers.map((p, idx) => (
                      <tr key={idx} style={{ borderBottom: idx < passengers.length - 1 ? "1px solid #e2e8f0" : "none" }}>
                        <td style={{ padding: "10px 16px", fontSize: "13px", borderBottom: idx < passengers.length - 1 ? "1px solid #e2e8f0" : "none" }}>
                          Room {p.roomIndex} - Guest {p.guestIndex}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: "13px", fontWeight: 600, borderBottom: idx < passengers.length - 1 ? "1px solid #e2e8f0" : "none" }}>
                          {p.name}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: "13px", textAlign: "center", color: "#6b7280", borderBottom: idx < passengers.length - 1 ? "1px solid #e2e8f0" : "none" }}>
                          {p.type}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Financial Ledger (B2B Agent Internal Copy) */}
            {target === "agent" && (
              <>
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#1f2937",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    borderBottom: "2px solid #e5e7eb",
                    paddingBottom: "8px",
                    margin: "25px 0 15px"
                  }}
                >
                  📈 Financial Analysis Matrix
                </h3>
                <table
                  width="100%"
                  cellPadding="0"
                  cellSpacing="0"
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    overflow: "hidden",
                    borderCollapse: "separate",
                    marginBottom: "25px"
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ padding: "12px 16px", fontSize: "13px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f9fafb" }}>
                        Core Net Provider Fare (Excl. Klar Markup)
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", borderBottom: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600 }}>
                        {currencyCode} {formatCurrency(netAmount)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "12px 16px", fontSize: "13px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f9fafb" }}>
                        Applied Klar Agency Markup / Profit
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", borderBottom: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: "#4f46e5" }}>
                        {currencyCode} {formatCurrency(markupAmount)}
                      </td>
                    </tr>
                    {rawStatus === "CANCELLED" && (
                      <tr>
                        <td style={{ padding: "12px 16px", fontSize: "13px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f9fafb" }}>
                          Cancellation Penalty (Charged by Supplier)
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", borderBottom: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: "#dc2626" }}>
                          {currencyCode} {formatCurrency(cancellationPenaltyVal)}
                        </td>
                      </tr>
                    )}
                    <tr style={{ backgroundColor: "#f8fafc" }}>
                      <td style={{ padding: "14px 16px", fontSize: "14px", fontWeight: 700 }}>
                        {rawStatus === "CANCELLED" ? "Net Refund Disbursed to Wallet" : "Total Collection Vector (Client Total)"}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "16px", fontWeight: 800, textAlign: "right", color: rawStatus === "CANCELLED" ? "#dc2626" : "#10b981" }}>
                        {currencyCode} {formatCurrency(rawStatus === "CANCELLED" ? refundAmountVal : totalAmount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}

            {/* Financial Ledger (B2C / Guest Client Copy) */}
            {target === "client" && (
              <>
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#1f2937",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    borderBottom: "2px solid #e5e7eb",
                    paddingBottom: "8px",
                    margin: "25px 0 15px"
                  }}
                >
                  💳 Payment Breakdown
                </h3>
                <table
                  width="100%"
                  cellPadding="0"
                  cellSpacing="0"
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    overflow: "hidden",
                    borderCollapse: "separate",
                    marginBottom: "25px"
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ padding: "12px 16px", fontSize: "13px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f9fafb" }}>
                        Original Total Paid (Inclusive of Taxes & Fees)
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", borderBottom: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600 }}>
                        {currencyCode} {formatCurrency(totalAmount)}
                      </td>
                    </tr>
                    {rawStatus === "CANCELLED" && (
                      <>
                        <tr>
                          <td style={{ padding: "12px 16px", fontSize: "13px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f9fafb" }}>
                            Cancellation Penalty / Hotel Fees
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: "13px", borderBottom: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: "#dc2626" }}>
                            - {currencyCode} {formatCurrency(cancellationPenaltyVal)}
                          </td>
                        </tr>
                        <tr style={{ backgroundColor: "#fee2e2" }}>
                          <td style={{ padding: "14px 16px", fontSize: "14px", fontWeight: 700, color: "#991b1b" }}>
                            Final Refund Amount
                          </td>
                          <td style={{ padding: "14px 16px", fontSize: "16px", fontWeight: 800, textAlign: "right", color: "#b91c1c" }}>
                            {currencyCode} {formatCurrency(refundAmountVal)}
                          </td>
                        </tr>
                      </>
                    )}
                    {rawStatus !== "CANCELLED" && (
                      <tr style={{ backgroundColor: "#ecfdf5" }}>
                        <td style={{ padding: "14px 16px", fontSize: "14px", fontWeight: 700, color: "#065f46" }}>
                          Total Amount Paid
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: "16px", fontWeight: 800, textAlign: "right", color: "#047857" }}>
                          {currencyCode} {formatCurrency(totalAmount)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </>
            )}

            {/* Flight-like Price / Status Banner (Highlighting the final status) */}
            <div
              style={{
                background:
                  rawStatus === "CONFIRMED"
                    ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    : rawStatus === "CANCELLED"
                    ? "linear-gradient(135deg, #f87171 0%, #dc2626 100%)"
                    : rawStatus === "HELD"
                    ? "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)"
                    : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                borderRadius: "12px",
                padding: "20px 24px",
                display: "table",
                width: "100%",
                boxSizing: "border-box",
                color: "#ffffff"
              }}
            >
              <table width="100%" cellPadding="0" cellSpacing="0">
                <tr>
                  <td valign="middle">
                    <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.85, display: "block", marginBottom: "4px" }}>
                      Booking Status
                    </span>
                    <span
                      style={{
                        display: "inline-block",
                        backgroundColor: statusBadgeColor,
                        color: statusTextColor,
                        padding: "4px 10px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px"
                      }}
                    >
                      {displayStatus}
                    </span>
                  </td>
                  <td align="right" valign="middle">
                    <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.85, display: "block", marginBottom: "4px" }}>
                      {rawStatus === "CANCELLED" ? "Total Refund Owed" : "Total Amount"}
                    </span>
                    <span style={{ fontSize: "28px", fontWeight: 900 }}>
                      <span style={{ fontSize: "16px", fontWeight: 600, marginRight: "4px" }}>{currencyCode}</span>
                      {formatCurrency(rawStatus === "CANCELLED" ? refundAmountVal : totalAmount)}
                    </span>
                  </td>
                </tr>
              </table>
            </div>

            {/* Terms and Conditions (Flight-like Style) */}
            <div style={{ marginTop: "30px", borderTop: "1px dashed #e2e8f0", paddingTop: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: "#4b5563", marginBottom: "8px" }}>
                📝 Important Information
              </div>
              <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "12px", color: "#6b7280", lineHeight: "1.7" }}>
                <li>Standard check-in time is 2:00 PM and check-out time is 12:00 PM (Local Hotel Time).</li>
                <li>Please carry a valid government-issued photo ID (Aadhaar Card, Driving License, or Passport) for all checking-in guests.</li>
                <li>Any incidentals or extra services (room service, mini bar, telephone) must be settled directly with the hotel upon check-out.</li>
                {rawStatus === "CANCELLED" && (
                  <li>Refund processes can take 1–2 hours to clear back into the Klar Wallet or up to 5-7 business days for credit cards.</li>
                )}
                {rawStatus === "HELD" && (
                  <li>On-hold bookings are subject to automatic release if payment or validation is not completed within the timeline.</li>
                )}
              </ul>
            </div>
          </td>
        </tr>

        {/* Footer */}
        <tr>
          <td
            style={{
              padding: "24px",
              textAlign: "center",
              fontSize: "12px",
              backgroundColor: "#f9fafb",
              color: "#6b7280",
              borderTop: "1px solid #e5e7eb"
            }}
          >
            <p style={{ margin: "0 0 8px" }}>
              This is an automated system confirmation from Klar Travels. Please do not reply directly to this email.
            </p>
            <p style={{ margin: "0 0 8px" }}>
              For any queries or modifications, please get in touch with us at{" "}
              <a href="mailto:support@klartravels.com" style={{ color: "#4f46e5", textDecoration: "none", fontWeight: 600 }}>
                support@klartravels.com
              </a>
            </p>
            <p style={{ margin: 0 }}>
              &copy; {new Date().getFullYear()} Klar Travels. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </div>
  );
};
