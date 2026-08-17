/**
 * Insurance booking confirmation email.
 *
 * Rendered here rather than in email-service because email-service exposes a
 * generic `POST /send` that takes `html` — it owns delivery, not content. This
 * is the same split flight-service already uses for its booking confirmation.
 *
 * Built with template literals rather than Handlebars: flight-service pulls in
 * Handlebars, but insurance-service has no template engine and adding one for a
 * single email would be a dependency this feature does not need.
 */

export type InsuranceRecipientType = "B2B_CLIENT" | "TRAVELLER";

export interface InsuranceConfirmationTraveller {
    name: string;
    policyId?: string;
}

export interface InsuranceConfirmationData {
    bookingId: string;
    planName: string;
    provider?: string;
    coverageRegion?: string;
    coverageStart?: string;
    coverageEnd?: string;
    amount: string;
    travellers: InsuranceConfirmationTraveller[];
    /** Shapes the wording only — the recipient list is decided elsewhere. */
    recipientType: InsuranceRecipientType;
}

/**
 * Escape user-controlled values before they reach the HTML.
 *
 * Traveller names come from the booking payload, so an unescaped name could
 * inject markup into an email we send on the customer's behalf.
 */
function escapeHtml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** A label/value row, omitted entirely when there is no value to show. */
function row(label: string, value?: string): string {
    if (!value) return "";
    return `
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px;">${escapeHtml(label)}</td>
          <td style="padding:8px 0;color:#111827;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(value)}</td>
        </tr>`;
}

export function renderInsuranceBookingConfirmation(data: InsuranceConfirmationData): string {
    const isAgencyCopy = data.recipientType === "B2B_CLIENT";

    const intro = isAgencyCopy
        ? "An insurance policy has been booked through your agency. Details are below for your records."
        : "Your travel insurance is confirmed. Please keep this email for your records.";

    const travellerRows = data.travellers
        .map(
            (t) => `
        <tr>
          <td style="padding:6px 0;color:#111827;font-size:13px;">${escapeHtml(t.name)}</td>
          <td style="padding:6px 0;color:#6b7280;font-size:12px;text-align:right;">${
              t.policyId ? `Policy ${escapeHtml(t.policyId)}` : "Policy number pending"
          }</td>
        </tr>`
        )
        .join("");

    const coverage =
        data.coverageStart && data.coverageEnd
            ? `${data.coverageStart} to ${data.coverageEnd}`
            : data.coverageStart || "";

    return `<!DOCTYPE html>
    <html>
      <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#1e243d;padding:20px 24px;">
              <h1 style="margin:0;color:#ffffff;font-size:18px;">Insurance Booking Confirmed</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.5;">${escapeHtml(intro)}</p>

              <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;">
                <p style="margin:0 0 4px;color:#6b7280;font-size:12px;">Booking reference</p>
                <p style="margin:0;color:#111827;font-size:16px;font-weight:700;">${escapeHtml(data.bookingId)}</p>
              </div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                ${row("Plan", data.planName)}
                ${row("Provider", data.provider)}
                ${row("Coverage region", data.coverageRegion)}
                ${row("Coverage period", coverage)}
                ${row("Premium paid", data.amount)}
              </table>

              ${
                  travellerRows
                      ? `<h2 style="margin:24px 0 8px;color:#111827;font-size:14px;">Insured</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${travellerRows}</table>`
                      : ""
              }

              <p style="margin:24px 0 0;color:#6b7280;font-size:12px;line-height:1.5;">
                If any detail above looks wrong, please contact support with your booking reference before travelling.
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>`;
}

/** Subject line. The agency copy is marked so it is filterable in a shared inbox. */
export function insuranceBookingConfirmationSubject(
    bookingId: string,
    recipientType: InsuranceRecipientType
): string {
    return recipientType === "B2B_CLIENT"
        ? `Insurance Booking Confirmation - ${bookingId} (Agency Copy)`
        : `Insurance Booking Confirmation - ${bookingId}`;
}
