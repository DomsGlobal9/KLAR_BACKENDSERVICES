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

/**
 * Journey type as declared by the caller (ict or the _journeyType hint).
 * Null when the caller said nothing — the Book contract has no ict field,
 * so this is null for most requests.
 */
export function explicitJourneyType(payload: any): InsuranceJourneyType | null {
    const ict = (payload.ict || payload.pli?.[0]?.pi?.[0]?.ict || payload._journeyType || "")
        .toString()
        .toUpperCase();
    if (ict === "STUDENT") return InsuranceJourneyType.STUDENT;
    if (ict === "AMT")     return InsuranceJourneyType.AMT;
    if (ict === "API_EMB" || ict === "EMBEDDED") return InsuranceJourneyType.EMBEDDED;
    return null;
}

/**
 * Journey type recorded against the booking. Falls back to the product id,
 * which carries the plan family (…PLAN_250_STUDENT…, …_ANNUAL…) — without
 * this every Student and AMT booking was stored as STANDALONE (F-05).
 * Used for persistence/reporting only; it never gates validation.
 */
export function detectJourneyType(payload: any): InsuranceJourneyType {
    const explicit = explicitJourneyType(payload);
    if (explicit) return explicit;

    const pid: string = payload.pli?.[0]?.pi?.[0]?.pid || "";
    if (/_STUDENT/i.test(pid)) return InsuranceJourneyType.STUDENT;
    if (/ANNUAL|_AMT/i.test(pid)) return InsuranceJourneyType.AMT;

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

        // ── Payment amount validation ───────────────────────────────────────
        // A missing/zero/negative amount cannot be a valid purchase and was
        // previously forwarded upstream and persisted as 0 (F-06).
        const amount = Number(payload.paymentInfos[0]?.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw {
                status: 400,
                message: "paymentInfos[0].amount must be a number greater than 0.",
            };
        }

        // ── Per-traveller validation ────────────────────────────────────────
        const journeyType = detectJourneyType(payload);
        // Student course data is demanded only when the caller explicitly
        // declared a Student journey — same requests are rejected as before.
        const declaredStudent = explicitJourneyType(payload) === InsuranceJourneyType.STUDENT;

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
                    if (declaredStudent && !traveller.sc) {
                        throw { status: 400, message: "Student course info (sc) is mandatory for STUDENT plans." };
                    }
                }
            }
        }

        // ── Proxy to TripJack ───────────────────────────────────────────────
        const tjResponse = await tripJackInsuranceProvider.book(payload);
        const tjBookingId: string = tjResponse?.order?.bookingId || payload.bookingId;
        let persisted = false;

        // ── Persist to MongoDB ──────────────────────────────────────────────
        try {

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

                amount,
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
            persisted = true;
            console.log(`✅ [TripSafe] Saved PENDING booking: ${tjBookingId} (DB: ${saved._id})`);

            // Start fire-and-forget status polling
            pollInsuranceStatus(tjBookingId, (saved._id as any).toString());

        } catch (dbErr: any) {
            // The customer has been charged upstream but we hold no local
            // record — this needs manual reconciliation, so make it greppable
            // rather than a passing remark in the log (F-07).
            console.error(
                `🚨 [TripSafe][ORPHANED_BOOKING] bookingId=${tjBookingId} amount=${amount} ` +
                `agentId=${agentId} — TripJack booking SUCCEEDED but DB persistence failed: ${dbErr?.message}`
            );
        }

        return {
            status: true,
            statusCode: 200,
            bookingId: tjBookingId,
            persisted,
            body: tjResponse,
        };
    }
}

export const bookService = new BookService();
