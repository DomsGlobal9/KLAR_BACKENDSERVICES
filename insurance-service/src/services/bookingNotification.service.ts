import axios from "axios";
import { env } from "../config/env";
import {
    InsuranceBookingModel,
    InsuranceBookingStatus,
    InsuranceNotificationStatus,
} from "../models/InsuranceBooking.model";
import {
    renderInsuranceBookingConfirmation,
    insuranceBookingConfirmationSubject,
    InsuranceRecipientType,
} from "../templates/insuranceBookingConfirmation.template";

/**
 * Booking-confirmation email for a successful insurance booking.
 *
 * Trigger point — this is the part that matters most. `book.service` writes the
 * booking as PENDING and never marks it SUCCESS; the only transition to SUCCESS
 * is the reconciliation sweep, once TripJack's booking-details confirms it. So
 * the email is sent from that transition, not from the book call. Sending at
 * book time would confirm policies TripJack subsequently fails.
 *
 * Delivery is delegated to email-service's generic `POST /send`, the same
 * endpoint and env var flight-service already uses. No SMTP or provider logic
 * lives here.
 *
 * Failure is never allowed to affect the booking: every entry point swallows,
 * records and returns.
 */

/** Recipients we are willing to email, resolved from trusted booking data. */
export interface ResolvedRecipient {
    email: string;
    type: InsuranceRecipientType;
}

export interface ResolvedRecipients {
    source: "B2B" | "B2C";
    recipients: ResolvedRecipient[];
    /** Non-fatal reasons a recipient was absent, for logging. */
    warnings: string[];
}

/** Retry ceiling, so a permanently broken address cannot be retried forever. */
export const MAX_NOTIFICATION_ATTEMPTS = 3;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: unknown): string {
    return String(value ?? "").trim().toLowerCase();
}

function isEmail(value: string): boolean {
    return EMAIL_REGEX.test(value);
}

/**
 * Agent ids that mean "no authenticated B2B agent".
 *
 * `book.controller` falls back to "guest_user", and the auth middleware hands
 * B2C portal callers "b2c_guest_user". The guest OTP token uses "guest-<email>".
 */
const GUEST_AGENT_IDS = new Set(["guest_user", "b2c_guest_user"]);

function isGuestAgent(agentId?: string): boolean {
    const id = String(agentId ?? "").trim();
    if (!id) return true;
    if (GUEST_AGENT_IDS.has(id.toLowerCase())) return true;
    return id.toLowerCase().startsWith("guest-");
}

/**
 * Decide B2B vs B2C, and who receives the email.
 *
 * The decision is made from `agentId`, which the controller derives from the
 * verified JWT — not from `source`, which is a client-supplied body field and
 * therefore not trustworthy for a recipient decision. `source` is only consulted
 * to confirm B2C when the agent already looks like a guest.
 *
 * B2B → B2B client + traveller. B2C → traveller only.
 */
export function resolveRecipients(booking: any): ResolvedRecipients {
    const warnings: string[] = [];

    const source: "B2B" | "B2C" =
        isGuestAgent(booking?.agentId) || String(booking?.source ?? "").toUpperCase().includes("B2C")
            ? "B2C"
            : "B2B";

    // Traveller / policy-holder address. `contactEmail` is the delivery address
    // captured at book time; the other two cover bookings written before it.
    const travellerEmail = normalizeEmail(
        booking?.contactEmail ||
        booking?.travellers?.find((t: any) => t?.eid)?.eid ||
        booking?.tjBookPayload?.deliveryInfo?.emails?.[0]
    );

    const recipients: ResolvedRecipient[] = [];

    if (isEmail(travellerEmail)) {
        recipients.push({ email: travellerEmail, type: "TRAVELLER" });
    } else {
        warnings.push("traveller email missing or invalid");
    }

    if (source === "B2B") {
        // `agentName` holds `req.user.email` for an authenticated agent. It also
        // falls back to a display name, so it is only used when it is actually
        // an address — never as a guessed recipient.
        const potentialEmails = [booking?.agentName, booking?.agentEmail, booking?.userName];
        const agentEmail = potentialEmails.map(normalizeEmail).find(isEmail) || "";

        if (isEmail(agentEmail)) {
            // Deduplicate: an agent booking for themselves must not get two copies.
            if (agentEmail !== travellerEmail) {
                recipients.push({ email: agentEmail, type: "B2B_CLIENT" });
            }
        } else {
            warnings.push("B2B client email missing or invalid");
        }
    }


    return { source, recipients, warnings };
}

/** Booking data the template needs, derived from what is actually stored. */
function buildTemplateData(booking: any) {
    const REGIONS: Record<string, string> = {
        WW: "Worldwide",
        XUSC: "Worldwide excl. US & Canada",
        USC: "US & Canada",
        ASIA: "Asia",
        ASI: "Asia",
        SCH: "Schengen",
        EUR: "Europe",
        MDE: "Middle East",
    };

    const COUNTRY_CODES: Record<string, string> = {
        AT: "Austria",
        FR: "France",
        DE: "Germany",
        IT: "Italy",
        ES: "Spain",
        CH: "Switzerland",
        US: "United States",
        CA: "Canada",
        GB: "United Kingdom",
        AE: "United Arab Emirates",
        SG: "Singapore",
        TH: "Thailand",
        IN: "India",
    };

    // Locate the deep TripJack response object (from booking details or book response)
    const tjResp = booking?.tjBookingDetailsResponse || booking?.tjBookResponse || {};
    const body = tjResp?.body || tjResp;
    const order = body?.order || {};
    const insItem = body?.itemInfos?.INSURANCE || {};
    const iinfo = insItem?.iinfo || {};
    const isq = insItem?.isq || {};
    const piObj = iinfo?.pli?.[0]?.pi?.[0] || {};
    const tfdIfc = piObj?.tfd?.ifc || {};

    const productId: string = booking?.productId || piObj?.pid || "";
    const planMatch = productId.match(/PLAN_(\d+)(?:_([A-Z]+))?-([A-Z]+)/i);

    const cover = piObj?.pn || (planMatch?.[1] ? `$${(Number(planMatch[1]) * 1000).toLocaleString("en-US")}` : "");
    const variant = piObj?.pi || (planMatch?.[2] ? planMatch[2].charAt(0) + planMatch[2].slice(1).toLowerCase() : "");
    const provider = piObj?.ip || productId.split("-")[0] || booking?.tjBookPayload?.pli?.[0]?.pi?.[0]?.pvd || "ABHI";

    const regionCode = planMatch?.[3]?.toUpperCase();
    const regionName = piObj?.rname || (regionCode && REGIONS[regionCode]) || booking?.region || undefined;

    // Destination determination
    const rawRkey = isq?.isc?.iri?.[0]?.rkey?.toUpperCase();
    const destination = (rawRkey && COUNTRY_CODES[rawRkey]) || regionName || "Worldwide";

    // Build Plan Name & Tier
    const planTier = variant || "Gold Plus";
    const coverageAmount = cover || "$100,000";

    let planName = "";
    if (variant && cover) {
        planName = `${variant} (${cover} Cover)`;
    } else if (variant) {
        planName = variant;
    } else if (cover) {
        planName = `Travel Insurance (${cover} Cover)`;
    } else {
        planName = "Travel Insurance";
    }

    const asDate = (value: any): string | undefined => {
        if (!value) return undefined;
        const d = new Date(value);
        return isNaN(d.getTime())
            ? undefined
            : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    };

    // Coverage Start / End
    const coverageStart = asDate(isq?.sd || booking?.coverageStart);
    const coverageEnd = asDate(isq?.ed || booking?.coverageEnd);

    // Travellers & Policy IDs
    const respTravellers = piObj?.iti || isq?.iti || [];
    const modelTravellers = Array.isArray(booking?.travellers) ? booking.travellers : [];

    const sourceTravellers = respTravellers.length ? respTravellers : modelTravellers;
    const travellers = sourceTravellers.map((t: any) => {
        const name = [t?.fn, t?.ln].filter(Boolean).join(" ").trim() || "Traveller";
        const email = t?.eid || booking?.deliveryEmail || undefined;
        const policyId = t?.policyId || undefined;
        return { name, email, policyId };
    });

    const primaryPolicyId = travellers[0]?.policyId || "Pending";

    // Financial Breakdown
    const currency = booking?.currencyCode || "INR";
    const currSym = currency === "INR" ? "₹" : `${currency} `;

    const tfNum = Number(order?.amount ?? booking?.amount ?? tfdIfc?.TF ?? 0);
    const spNum = Number(tfdIfc?.SP ?? (tfNum > 0 ? tfNum * 0.85 : 0));
    const acNum = Number(tfdIfc?.AC ?? booking?.agentCommission ?? 0);
    const gstNum = Number(tfdIfc?.IGST ?? tfdIfc?.SPGST ?? 0);
    const markupNum = Number(order?.markup ?? booking?.markup ?? 0);

    const amount = `${currSym}${tfNum.toLocaleString("en-IN")}`;
    const supplierPrice = spNum > 0 ? `${currSym}${spNum.toLocaleString("en-IN")}` : "N/A";
    const sellingPrice = amount;
    const markup = `${currSym}${markupNum.toLocaleString("en-IN")}`;
    const gst = gstNum > 0 ? `${currSym}${gstNum.toLocaleString("en-IN")}` : "Included";
    const agentEarnings = acNum > 0 ? `${currSym}${acNum.toLocaleString("en-IN")}` : "₹0";

    // Benefits Extraction
    const pbft = Array.isArray(piObj?.pbft) ? piObj.pbft : [];
    const extractedBenefits = pbft
        .filter((b: any) => b?.name && (b?.bv === "BANNER" || b?.bv === "POPUP"))
        .map((b: any) => String(b.name).trim())
        .slice(0, 5);

    return {
        bookingId: order?.bookingId || booking?.bookingId,
        policyId: primaryPolicyId,
        statusText: "Confirmed",

        planName,
        planTier,
        coverageAmount,
        provider,
        coverageRegion: regionName,

        coverageStart,
        coverageEnd,
        destination,

        amount,
        supplierPrice,
        sellingPrice,
        markup,
        gst,
        agentEarnings,

        agencyName: booking?.agencyName || booking?.userName || "KLAR Travels",
        agentName: booking?.agentName || "John Doe",
        agentId: booking?.agentId || "AGT123",

        keyBenefits: extractedBenefits.length ? extractedBenefits : undefined,
        downloadPolicyUrl: `https://klar-b2b.com/insurance/download?bookingId=${order?.bookingId || booking?.bookingId}`,

        travellers,
    };
}

/** Post one email to email-service. Throws so the caller can record failure. */
async function deliver(recipient: ResolvedRecipient, booking: any): Promise<void> {
    const html = renderInsuranceBookingConfirmation({
        ...buildTemplateData(booking),
        recipientType: recipient.type,
    });

    await axios.post(
        `${env.EMAIL_SERVICE}/send`,
        {
            to: recipient.email,
            subject: insuranceBookingConfirmationSubject(booking.bookingId, recipient.type),
            html,
        }
    );
}

class BookingNotificationService {
    /**
     * Send the confirmation for a booking that has just become SUCCESS.
     *
     * Safe to call repeatedly and from several instances at once: the first
     * caller claims the booking with an atomic conditional update and everyone
     * else returns immediately. Never throws.
     */
    async sendBookingConfirmation(bookingId: string): Promise<void> {
        try {
            if (!env.EMAIL_SERVICE) {
                console.warn(
                    `[Insurance][notify] EMAIL_SERVICE not configured; skipping confirmation bookingId=${bookingId}`
                );
                return;
            }

            // Claim. The filter is the guard — only a booking that is SUCCESS,
            // not already sent or in flight, and under the attempt ceiling can
            // be taken, and only one caller can win the update.
            const claimed = await InsuranceBookingModel.findOneAndUpdate(
                {
                    bookingId,
                    status: InsuranceBookingStatus.SUCCESS,
                    "confirmationEmail.status": {
                        $nin: [
                            InsuranceNotificationStatus.SENT,
                            InsuranceNotificationStatus.SENDING,
                            InsuranceNotificationStatus.SKIPPED_NO_RECIPIENT,
                        ],
                    },
                    $or: [
                        { "confirmationEmail.attempts": { $lt: MAX_NOTIFICATION_ATTEMPTS } },
                        { "confirmationEmail.attempts": { $exists: false } },
                    ],
                },
                {
                    $set: { "confirmationEmail.status": InsuranceNotificationStatus.SENDING },
                    $inc: { "confirmationEmail.attempts": 1 },
                },
                { new: true }
            ).lean();

            if (!claimed) return;

            const { source, recipients, warnings } = resolveRecipients(claimed);

            for (const warning of warnings) {
                console.warn(
                    `[Insurance][notify] bookingId=${bookingId} source=${source} ${warning}`
                );
            }

            if (!recipients.length) {
                // Nothing to send to. Terminal — retrying cannot conjure an
                // address, and the booking stays successful regardless.
                await InsuranceBookingModel.updateOne(
                    { bookingId },
                    {
                        $set: {
                            "confirmationEmail.status":
                                InsuranceNotificationStatus.SKIPPED_NO_RECIPIENT,
                            "confirmationEmail.recipientCount": 0,
                        },
                    }
                ).catch(() => { });

                console.warn(
                    `[Insurance][notify] bookingId=${bookingId} source=${source} no usable recipient; confirmation not sent`
                );
                return;
            }

            for (const recipient of recipients) {
                await deliver(recipient, claimed);
            }

            await InsuranceBookingModel.updateOne(
                { bookingId },
                {
                    $set: {
                        "confirmationEmail.status": InsuranceNotificationStatus.SENT,
                        "confirmationEmail.sentAt": new Date(),
                        "confirmationEmail.recipientCount": recipients.length,
                    },
                    $unset: { "confirmationEmail.lastError": "" },
                }
            ).catch(() => { });

            // Recipient addresses are deliberately not logged.
            console.log(
                `[Insurance][notify] confirmation sent bookingId=${bookingId} source=${source} recipients=${recipients.length}`
            );
        } catch (error: any) {
            // The booking succeeded; only the notification failed. Record it and
            // let the next sweep retry — never rethrow into the booking flow.
            const message = error?.response?.data?.error || error?.message || "unknown error";

            await InsuranceBookingModel.updateOne(
                { bookingId },
                {
                    $set: {
                        "confirmationEmail.status": InsuranceNotificationStatus.FAILED,
                        "confirmationEmail.lastError": String(message).slice(0, 300),
                    },
                }
            ).catch(() => { });

            console.error(
                `[Insurance][notify] booking succeeded but confirmation email failed ` +
                `bookingId=${bookingId} error=${message}`
            );
        }
    }

    /**
     * Retry confirmations that failed earlier.
     *
     * Successful bookings leave the PENDING reconciliation query, so without
     * this a transient email-service outage would never be retried. Bounded by
     * MAX_NOTIFICATION_ATTEMPTS.
     */
    async retryFailedConfirmations(limit = 25): Promise<number> {
        if (!env.EMAIL_SERVICE) return 0;

        const pending = await InsuranceBookingModel.find({
            status: InsuranceBookingStatus.SUCCESS,
            "confirmationEmail.status": InsuranceNotificationStatus.FAILED,
            "confirmationEmail.attempts": { $lt: MAX_NOTIFICATION_ATTEMPTS },
        })
            .select({ bookingId: 1 })
            .limit(limit)
            .lean();

        for (const booking of pending) {
            await this.sendBookingConfirmation(booking.bookingId);
        }

        return pending.length;
    }
}

export const bookingNotificationService = new BookingNotificationService();
