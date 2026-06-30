import { tripJackInsuranceProvider } from "../providers/tripjack.insurance.provider";
import {
    InsuranceBookingModel,
    InsuranceBookingStatus,
    InsuranceJourneyType,
} from "../models/InsuranceBooking.model";

// ─── Async Status Poller ──────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5_000;   // 5 s
const POLL_TIMEOUT_MS  = 120_000; // 2 min

const TJ_SUCCESS  = new Set(["SUCCESS"]);
const TJ_FAILED   = new Set(["FAILED", "CANCELLED", "ABORTED"]);

async function pollInsuranceStatus(tjBookingId: string, dbId: string): Promise<void> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    const poll = async (): Promise<void> => {
        if (Date.now() >= deadline) {
            console.warn(`[TripSafe] Polling timeout for ${tjBookingId}. Leaving as PENDING.`);
            return;
        }
        try {
            const details = await tripJackInsuranceProvider.bookingDetails(tjBookingId);
            const insStatus: string =
                details?.order?.status ||
                details?.itemInfos?.INSURANCE?.ios ||
                "";

            console.log(`[TripSafe] Poll ${tjBookingId}: status=${insStatus}`);

            if (TJ_SUCCESS.has(insStatus)) {
                await InsuranceBookingModel.findByIdAndUpdate(dbId, {
                    status: InsuranceBookingStatus.SUCCESS,
                    tjBookingDetailsResponse: details,
                });
                console.log(`✅ [TripSafe] Booking ${tjBookingId} → SUCCESS`);
                return;
            }
            if (TJ_FAILED.has(insStatus)) {
                await InsuranceBookingModel.findByIdAndUpdate(dbId, {
                    status: InsuranceBookingStatus.FAILED,
                    tjBookingDetailsResponse: details,
                });
                console.warn(`❌ [TripSafe] Booking ${tjBookingId} → ${insStatus}`);
                return;
            }

            await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
            return poll();
        } catch (err: any) {
            console.error("[TripSafe] Polling error:", err?.message);
            await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
            return poll();
        }
    };

    // Fire-and-forget — does NOT block the HTTP response
    poll().catch(e => console.error("[TripSafe] Uncaught poll error:", e?.message));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectJourneyType(payload: any): InsuranceJourneyType {
    const ict = (payload.ict || payload.pli?.[0]?.pi?.[0]?.ict || "").toUpperCase();
    if (ict === "STUDENT") return InsuranceJourneyType.STUDENT;
    if (ict === "AMT")     return InsuranceJourneyType.AMT;
    if (ict === "API_EMB" || ict === "EMBEDDED") return InsuranceJourneyType.EMBEDDED;

    // Fallback to hint field
    if (payload._journeyType) {
        const jt = payload._journeyType.toUpperCase();
        if (jt === "STUDENT")  return InsuranceJourneyType.STUDENT;
        if (jt === "AMT")      return InsuranceJourneyType.AMT;
        if (jt === "EMBEDDED") return InsuranceJourneyType.EMBEDDED;
    }
    return InsuranceJourneyType.STANDALONE;
}

// ─── Book Service ─────────────────────────────────────────────────────────────

class BookService {
    async book(
        payload: any,
        agentId?: string | null,
        agentName?: string | null
    ) {
        // ── Required field validation ───────────────────────────────────────
        if (!payload.bookingId) {
            throw { status: 400, message: "bookingId (from Review API) is required." };
        }
        if (!payload.pli?.length) {
            throw { status: 400, message: "pli (plan list) is required." };
        }
        if (!payload.paymentInfos?.length) {
            throw { status: 400, message: "paymentInfos is required. Use WALLET or CREDIT_LINE." };
        }

        // ── Per-traveller validation ────────────────────────────────────────
        const journeyType = detectJourneyType(payload);

        for (const plan of payload.pli) {
            for (const product of plan.pi || []) {
                for (const traveller of product.iti || []) {
                    const required = ["dob", "fn", "ln", "eid", "pnum", "gen"];
                    for (const field of required) {
                        if (!traveller[field]) {
                            throw {
                                status: 400,
                                message: `Traveller field '${field}' is mandatory.`,
                            };
                        }
                    }
                    if (!traveller.ni?.length || !traveller.ni[0]?.nn) {
                        throw { status: 400, message: "Nominee info (ni) is mandatory for every traveller." };
                    }
                    // Student: sc (student course) is mandatory
                    if (journeyType === InsuranceJourneyType.STUDENT && !traveller.sc) {
                        throw { status: 400, message: "Student course info (sc) is mandatory for STUDENT plans." };
                    }
                }
            }
        }

        // ── Proxy to TripJack ───────────────────────────────────────────────
        const tjResponse = await tripJackInsuranceProvider.book(payload);

        // ── Persist to MongoDB ──────────────────────────────────────────────
        try {
            const tjBookingId: string = tjResponse?.order?.bookingId || payload.bookingId;

            // Extract travellers for storage
            const travellers: any[] = [];
            for (const plan of payload.pli) {
                for (const product of plan.pi || []) {
                    for (const t of product.iti || []) {
                        travellers.push(t);
                    }
                }
            }

            // Extract coverage dates from review payload echoed in booking
            const firstPlan = payload.pli?.[0];
            const coverageStart = payload.sd ? new Date(payload.sd) : undefined;
            const coverageEnd   = payload.ed ? new Date(payload.ed) : undefined;

            const record = new InsuranceBookingModel({
                bookingId: tjBookingId,
                journeyType,
                planId:   firstPlan?.plid,
                productId: firstPlan?.pi?.[0]?.pid,

                coverageStart,
                coverageEnd,

                travellers,

                amount:      payload.paymentInfos?.[0]?.amount || 0,
                currencyCode: "INR",

                status: InsuranceBookingStatus.PENDING,

                agentId,
                agentName,
                userId:   agentId   ?? undefined,
                userName: agentName ?? undefined,

                tjBookPayload:  payload,
                tjBookResponse: tjResponse,
            });

            const saved = await record.save();
            console.log(`✅ [TripSafe] Saved PENDING booking: ${tjBookingId} (DB: ${saved._id})`);

            // Start fire-and-forget status polling
            pollInsuranceStatus(tjBookingId, (saved._id as any).toString());

        } catch (dbErr: any) {
            console.error("⚠️  [TripSafe] DB save failed (TJ API succeeded):", dbErr.message);
        }

        return {
            status: true,
            statusCode: 200,
            bookingId: tjResponse?.order?.bookingId || payload.bookingId,
            body: tjResponse,
        };
    }
}

export const bookService = new BookService();
