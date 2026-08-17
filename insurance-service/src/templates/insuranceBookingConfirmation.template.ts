/**
 * Insurance booking confirmation email templates.
 *
 * Provides dedicated Traveller and Agent (B2B Agent Copy) layout designs
 * per wireframe specifications.
 */

export type InsuranceRecipientType = "B2B_CLIENT" | "TRAVELLER";

export interface InsuranceConfirmationTraveller {
    name: string;
    email?: string;
    policyId?: string;
}

export interface InsuranceConfirmationData {
    bookingId: string;
    policyId?: string;
    statusText?: string;

    // Insurance details
    planName: string;
    planTier?: string;
    coverageAmount?: string;
    provider?: string;
    coverageRegion?: string;

    // Trip details
    coverageStart?: string;
    coverageEnd?: string;
    destination?: string;

    // Payment & Financials
    amount: string;
    supplierPrice?: string;
    sellingPrice?: string;
    markup?: string;
    gst?: string;
    agentEarnings?: string;

    // Agent Details (for B2B Copy)
    agencyName?: string;
    agentName?: string;
    agentId?: string;

    // Key benefits & links
    keyBenefits?: string[];
    downloadPolicyUrl?: string;

    travellers: InsuranceConfirmationTraveller[];
    recipientType: InsuranceRecipientType;
}

/**
 * Escape user-controlled values before inserting into HTML.
 */
function escapeHtml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderTravellerLayout(data: InsuranceConfirmationData, currentDate: string): string {
    const primaryTraveller = data.travellers[0]?.name || "Valued Customer";
    const primaryPolicyId = data.policyId || data.travellers[0]?.policyId || "Pending";

    const defaultBenefits = [
        "Emergency Medical & Hospitalization",
        "Medical Evacuation & Repatriation",
        "Loss & Delay of Checked-in Baggage",
        "Trip Cancellation & Delay Cover",
    ];

    const benefits = data.keyBenefits && data.keyBenefits.length > 0 ? data.keyBenefits : defaultBenefits;
    const benefitsHtml = benefits
        .map((b) => `<li style="margin-bottom: 6px; font-size: 13px; color: #374151;">${escapeHtml(b)}</li>`)
        .join("");

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Insurance Booking Confirmed · Klar Travels</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 20px; background-color: #e8e8e8; }
        .container {
            max-width: 650px;
            margin: 0 auto;
            background: #ffffff;
            padding: 30px;
            border: 3px solid #000;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            position: relative;
        }
        .container::before {
            content: ''; position: absolute; top: 8px; left: 8px; right: 8px; bottom: 8px;
            border: 1px solid #ccc; pointer-events: none; border-radius: 8px;
        }
        .header { border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 15px; }
        .header table { width: 100%; border-collapse: collapse; }
        .logo { max-height: 50px; width: auto; }
        .header-right { text-align: right; font-size: 11px; color: #333; line-height: 1.6; }
        .company-name { font-size: 15px; font-weight: bold; color: #000; letter-spacing: 1px; }
        .greeting { font-size: 15px; font-weight: bold; color: #111827; margin: 15px 0 5px; }
        .sub-greeting { font-size: 13px; color: #4b5563; margin-bottom: 20px; }
        .section-title { font-weight: bold; font-size: 13px; letter-spacing: 0.5px; text-transform: uppercase; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #000; color: #000; }
        .info-table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 8px 0 15px; font-size: 12px; }
        .info-table td { padding: 8px 12px; border: 1px solid #000; vertical-align: middle; }
        .info-table .label { font-weight: bold; background: #f5f5f5; width: 35%; color: #333; }
        .info-table .val { width: 65%; font-weight: 500; color: #111827; }
        .status-badge { display: inline-block; padding: 2px 10px; border: 1px solid #28a745; border-radius: 4px; color: #28a745; font-weight: bold; font-size: 11px; background: #f0fff0; }
        .btn-container { text-align: center; margin: 25px 0; }
        .btn-download { display: inline-block; background-color: #1d2b6b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 13px; letter-spacing: 0.5px; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
        .footer { margin-top: 25px; padding-top: 15px; border-top: 1px solid #ccc; text-align: center; color: #888; font-size: 11px; }
        @media only screen and (max-width: 600px) {
            body { padding: 8px; }
            .container { padding: 16px 12px; }
            .header td { display: block; text-align: center !important; width: 100% !important; }
            .header-right { text-align: center !important; margin-top: 8px; }
        }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <table cellpadding="0" cellspacing="0">
            <tr>
                <td align="left">
                    <img src="https://travel-pdfs-prod-399934155938-eu-north-1-an.s3.eu-north-1.amazonaws.com/pdf/KLARBlue.png" alt="Klar Travels" class="logo">
                </td>
                <td align="right" class="header-right">
                    <div class="company-name">KLAR TRAVELS</div>
                    <div>3rd Floor 305, Tilak Rd, Abids, Hyderabad</div>
                    <div>040-42603413 | 8099359377</div>
                    <div>Issued Date: ${escapeHtml(currentDate)}</div>
                </td>
            </tr>
        </table>
    </div>

    <div class="greeting">Hello ${escapeHtml(primaryTraveller)},</div>
    <div class="sub-greeting">Your insurance booking is confirmed. Please find your details below.</div>

    <!-- BOOKING DETAILS -->
    <div class="section-title">BOOKING DETAILS</div>
    <table class="info-table">
        <tr>
            <td class="label">Booking ID</td>
            <td class="val" style="font-weight: bold;">${escapeHtml(data.bookingId)}</td>
        </tr>
        <tr>
            <td class="label">Policy ID</td>
            <td class="val" style="font-weight: bold; font-family: monospace; font-size: 13px;">${escapeHtml(primaryPolicyId)}</td>
        </tr>
        <tr>
            <td class="label">Status</td>
            <td class="val"><span class="status-badge">${escapeHtml(data.statusText || "Confirmed")}</span></td>
        </tr>
    </table>

    <!-- INSURANCE DETAILS -->
    <div class="section-title">INSURANCE DETAILS</div>
    <table class="info-table">
        <tr>
            <td class="label">Provider</td>
            <td class="val">${escapeHtml(data.provider || "ABHI")}</td>
        </tr>
        <tr>
            <td class="label">Plan</td>
            <td class="val" style="font-weight: bold;">${escapeHtml(data.planTier || data.planName)}</td>
        </tr>
        <tr>
            <td class="label">Coverage</td>
            <td class="val" style="font-weight: bold;">${escapeHtml(data.coverageAmount || "$100,000")}</td>
        </tr>
        <tr>
            <td class="label">Region</td>
            <td class="val">${escapeHtml(data.coverageRegion || "Worldwide")}</td>
        </tr>
    </table>

    <!-- TRIP DETAILS -->
    <div class="section-title">TRIP DETAILS</div>
    <table class="info-table">
        <tr>
            <td class="label">Start</td>
            <td class="val">${escapeHtml(data.coverageStart || "N/A")}</td>
        </tr>
        <tr>
            <td class="label">End</td>
            <td class="val">${escapeHtml(data.coverageEnd || "N/A")}</td>
        </tr>
        <tr>
            <td class="label">Destination</td>
            <td class="val" style="font-weight: bold;">${escapeHtml(data.destination || data.coverageRegion || "N/A")}</td>
        </tr>
    </table>

    <!-- PAYMENT -->
    <div class="section-title">PAYMENT</div>
    <table class="info-table">
        <tr>
            <td class="label">Total Paid</td>
            <td class="val" style="font-weight: bold; font-size: 14px; color: #111827;">${escapeHtml(data.amount)}</td>
        </tr>
    </table>

    <!-- Key Benefits -->
    <div class="section-title">Key Benefits</div>
    <ul style="margin: 8px 0 15px 20px; padding: 0;">
        ${benefitsHtml}
    </ul>

    <!-- Footer -->
    <div class="footer">
        <p>This is a system generated confirmation. Please keep this email for your records.</p>
        <p>&copy; 2026 Klar Travels. All rights reserved.</p>
    </div>
</div>
</body>
</html>`;
}

function renderAgentLayout(data: InsuranceConfirmationData, currentDate: string): string {
    const primaryTraveller = data.travellers[0]?.name || "Traveller";
    const primaryEmail = data.travellers[0]?.email || "N/A";
    const primaryPolicyId = data.policyId || data.travellers[0]?.policyId || "Pending";

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Insurance Confirmation (Agent Copy) · Klar Travels</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 20px; background-color: #e8e8e8; }
        .container {
            max-width: 650px;
            margin: 0 auto;
            background: #ffffff;
            padding: 30px;
            border: 3px solid #000;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            position: relative;
        }
        .container::before {
            content: ''; position: absolute; top: 8px; left: 8px; right: 8px; bottom: 8px;
            border: 1px solid #ccc; pointer-events: none; border-radius: 8px;
        }
        .header { border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 15px; }
        .header table { width: 100%; border-collapse: collapse; }
        .logo { max-height: 50px; width: auto; }
        .header-right { text-align: right; font-size: 11px; color: #333; line-height: 1.6; }
        .company-name { font-size: 15px; font-weight: bold; color: #000; letter-spacing: 1px; }
        .agent-banner { background-color: #1d2b6b; color: #ffffff; text-align: center; padding: 8px 12px; border-radius: 6px; font-weight: bold; font-size: 12px; letter-spacing: 1px; margin: 15px 0; text-transform: uppercase; }
        .section-title { font-weight: bold; font-size: 13px; letter-spacing: 0.5px; text-transform: uppercase; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #000; color: #000; }
        .info-table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 8px 0 15px; font-size: 12px; }
        .info-table td { padding: 8px 12px; border: 1px solid #000; vertical-align: middle; }
        .info-table .label { font-weight: bold; background: #f5f5f5; width: 38%; color: #333; }
        .info-table .val { width: 62%; font-weight: 500; color: #111827; }
        .status-badge { display: inline-block; padding: 2px 10px; border: 1px solid #28a745; border-radius: 4px; color: #28a745; font-weight: bold; font-size: 11px; background: #f0fff0; }
        .earnings-val { color: #15803d; font-weight: bold; font-size: 13px; }
        .btn-container { text-align: center; margin: 25px 0; }
        .btn-download { display: inline-block; background-color: #1d2b6b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-size: 13px; letter-spacing: 0.5px; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
        .footer { margin-top: 25px; padding-top: 15px; border-top: 1px solid #ccc; text-align: center; color: #888; font-size: 11px; }
        @media only screen and (max-width: 600px) {
            body { padding: 8px; }
            .container { padding: 16px 12px; }
            .header td { display: block; text-align: center !important; width: 100% !important; }
            .header-right { text-align: center !important; margin-top: 8px; }
        }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <table cellpadding="0" cellspacing="0">
            <tr>
                <td align="left">
                    <img src="https://travel-pdfs-prod-399934155938-eu-north-1-an.s3.eu-north-1.amazonaws.com/pdf/KLARBlue.png" alt="Klar Travels" class="logo">
                </td>
                <td align="right" class="header-right">
                    <div class="company-name">KLAR TRAVELS</div>
                    <div>3rd Floor 305, Tilak Rd, Abids, Hyderabad</div>
                    <div>040-42603413 | 8099359377</div>
                    <div>Issued Date: ${escapeHtml(currentDate)}</div>
                </td>
            </tr>
        </table>
    </div>

    <div class="agent-banner">INSURANCE BOOKING CONFIRMED — B2B AGENT COPY</div>

    <!-- AGENT DETAILS -->
    <div class="section-title">AGENT DETAILS</div>
    <table class="info-table">
        <tr>
            <td class="label">Agency</td>
            <td class="val" style="font-weight: bold;">${escapeHtml(data.agencyName || "KLAR Travels")}</td>
        </tr>
        <tr>
            <td class="label">Agent</td>
            <td class="val">${escapeHtml(data.agentName || "Agent")}</td>
        </tr>
        <tr>
            <td class="label">Agent ID</td>
            <td class="val" style="font-weight: bold;">${escapeHtml(data.agentId || "N/A")}</td>
        </tr>
    </table>

    <!-- BOOKING DETAILS -->
    <div class="section-title">BOOKING DETAILS</div>
    <table class="info-table">
        <tr>
            <td class="label">Booking ID</td>
            <td class="val" style="font-weight: bold;">${escapeHtml(data.bookingId)}</td>
        </tr>
        <tr>
            <td class="label">Policy ID</td>
            <td class="val" style="font-weight: bold; font-family: monospace; font-size: 13px;">${escapeHtml(primaryPolicyId)}</td>
        </tr>
        <tr>
            <td class="label">Status</td>
            <td class="val"><span class="status-badge">${escapeHtml(data.statusText || "Confirmed")}</span></td>
        </tr>
    </table>

    <!-- TRAVELLER DETAILS -->
    <div class="section-title">TRAVELLER DETAILS</div>
    <table class="info-table">
        <tr>
            <td class="label">Traveller</td>
            <td class="val" style="font-weight: bold;">${escapeHtml(primaryTraveller)}</td>
        </tr>
        <tr>
            <td class="label">Email</td>
            <td class="val">${escapeHtml(primaryEmail)}</td>
        </tr>
    </table>

    <!-- INSURANCE DETAILS -->
    <div class="section-title">INSURANCE DETAILS</div>
    <table class="info-table">
        <tr>
            <td class="label">Provider</td>
            <td class="val">${escapeHtml(data.provider || "ABHI")}</td>
        </tr>
        <tr>
            <td class="label">Plan</td>
            <td class="val" style="font-weight: bold;">${escapeHtml(data.planTier || data.planName)}</td>
        </tr>
        <tr>
            <td class="label">Coverage</td>
            <td class="val" style="font-weight: bold;">${escapeHtml(data.coverageAmount || "$100,000")}</td>
        </tr>
        <tr>
            <td class="label">Region</td>
            <td class="val">${escapeHtml(data.coverageRegion || "Worldwide")}</td>
        </tr>
    </table>

    <!-- TRAVEL DETAILS -->
    <div class="section-title">TRAVEL DETAILS</div>
    <table class="info-table">
        <tr>
            <td class="label">Start</td>
            <td class="val">${escapeHtml(data.coverageStart || "N/A")}</td>
        </tr>
        <tr>
            <td class="label">End</td>
            <td class="val">${escapeHtml(data.coverageEnd || "N/A")}</td>
        </tr>
        <tr>
            <td class="label">Destination</td>
            <td class="val" style="font-weight: bold;">${escapeHtml(data.destination || data.coverageRegion || "N/A")}</td>
        </tr>
    </table>

    <!-- FINANCIAL SUMMARY -->
    <div class="section-title">FINANCIAL SUMMARY</div>
    <table class="info-table">
        <tr>
            <td class="label">Supplier Price</td>
            <td class="val">${escapeHtml(data.supplierPrice || "N/A")}</td>
        </tr>
        <tr>
            <td class="label">Selling Price</td>
            <td class="val" style="font-weight: bold;">${escapeHtml(data.sellingPrice || data.amount)}</td>
        </tr>
        <tr>
            <td class="label">Markup</td>
            <td class="val">${escapeHtml(data.markup || "₹0")}</td>
        </tr>
        <tr>
            <td class="label">GST</td>
            <td class="val">${escapeHtml(data.gst || "Included")}</td>
        </tr>
        <tr>
            <td class="label">Agent Earnings</td>
            <td class="val earnings-val">${escapeHtml(data.agentEarnings || "₹0")}</td>
        </tr>
    </table>

    <!-- Footer -->
    <div class="footer">
        <p>This is a system generated B2B confirmation copy. Confidential agency record.</p>
        <p>&copy; 2026 Klar Travels. All rights reserved.</p>
    </div>
</div>
</body>
</html>`;
}

export function renderInsuranceBookingConfirmation(data: InsuranceConfirmationData): string {
    const currentDate = new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });

    if (data.recipientType === "B2B_CLIENT") {
        return renderAgentLayout(data, currentDate);
    }
    return renderTravellerLayout(data, currentDate);
}

/** Subject line for email notification. Agency copy is flagged. */
export function insuranceBookingConfirmationSubject(
    bookingId: string,
    recipientType: InsuranceRecipientType
): string {
    return recipientType === "B2B_CLIENT"
        ? `Insurance Booking Confirmation - ${bookingId} (Agency Copy)`
        : `Insurance Booking Confirmation - ${bookingId}`;
}
