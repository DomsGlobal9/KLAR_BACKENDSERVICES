import { tripJackInsuranceProvider } from "../providers/tripjack.insurance.provider";
import {
    InsuranceBookingModel,
    InsuranceBookingStatus,
    InsuranceJourneyType,
} from "../models/InsuranceBooking.model";
import { InsuranceReviewContextModel } from "../models/InsuranceReviewContext.model";

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

/** Every traveller across the (single) plan and product, in payload order. */
function collectTravellers(payload: any): any[] {
    const out: any[] = [];
    for (const plan of payload.pli || []) {
        for (const product of plan.pi || []) {
            for (const t of product.iti || []) out.push(t);
        }
    }
    return out;
}

/** Whole years between a date of birth and a reference date. */
export function ageFromDob(dob: string, on: Date = new Date()): number | null {
    const born = new Date(dob);
    if (isNaN(born.getTime())) return null;
    let age = on.getFullYear() - born.getFullYear();
    const monthDelta = on.getMonth() - born.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && on.getDate() < born.getDate())) age--;
    return age;
}

/** Same calendar day. Unparseable input compares equal, so it never rejects. */
function sameCoverageDay(a: any, b: any): boolean {
    const x = new Date(a);
    const y = new Date(b);
    if (isNaN(x.getTime()) || isNaN(y.getTime())) return true;
    return x.toISOString().slice(0, 10) === y.toISOString().slice(0, 10);
}

/**
 * Compare Book against the trusted Review context (B1/B2/B3).
 * Only fields actually captured at Review are compared — a value we never
 * managed to read is never used to reject a booking.
 */
export function assertMatchesReview(payload: any, ctx: any, amount: number): void {
    const bookPlid = payload.pli?.[0]?.plid;
    const bookPid  = payload.pli?.[0]?.pi?.[0]?.pid;

    if (ctx.plid && bookPlid && ctx.plid !== bookPlid) {
        throw { status: 400, message: `Plan does not match the reviewed plan. Reviewed ${ctx.plid}, booking ${bookPlid}.` };
    }
    if (ctx.pid && bookPid && ctx.pid !== bookPid) {
        throw { status: 400, message: `Product does not match the reviewed product. Reviewed ${ctx.pid}, booking ${bookPid}.` };
    }

    const travellers = collectTravellers(payload);
    if (ctx.travellerCount > 0 && travellers.length !== ctx.travellerCount) {
        throw {
            status: 400,
            message: `Traveller count does not match the review. Reviewed ${ctx.travellerCount}, booking ${travellers.length}.`,
        };
    }

    // Ages are what the plan was priced on at Search/Review. Compare as a
    // multiset — traveller order is not contractually guaranteed.
    const reviewedAges: number[] = (ctx.travellers || [])
        .map((t: any) => Number(t?.age))
        .filter((n: number) => Number.isFinite(n));
    const bookedAges: number[] = travellers
        .map((t: any) => Number(t?.age))
        .filter((n: number) => Number.isFinite(n));

    if (reviewedAges.length && reviewedAges.length === bookedAges.length) {
        const a = [...reviewedAges].sort((x, y) => x - y).join(",");
        const b = [...bookedAges].sort((x, y) => x - y).join(",");
        if (a !== b) {
            throw {
                status: 400,
                message: `Traveller ages do not match the review. Reviewed [${a}], booking [${b}].`,
            };
        }
    }

    // DOB is only present in the review context for the embedded flow.
    const reviewedDobs = (ctx.travellers || []).map((t: any) => t?.dob).filter(Boolean).sort();
    const bookedDobs   = travellers.map((t: any) => t?.dob).filter(Boolean).sort();
    if (reviewedDobs.length && reviewedDobs.length === bookedDobs.length) {
        if (reviewedDobs.join(",") !== bookedDobs.join(",")) {
            throw { status: 400, message: "Traveller dates of birth do not match the review." };
        }
    }

    // Coverage dates are established by Review. The Book contract carries no
    // sd/ed (doc pp. 24-25), so any dates in the payload are non-contract
    // fields — reject ones that contradict the review rather than ignore them.
    if (ctx.sd && payload.sd && !sameCoverageDay(ctx.sd, payload.sd)) {
        throw { status: 400, message: "Coverage start date does not match the reviewed coverage." };
    }
    if (ctx.ed && payload.ed && !sameCoverageDay(ctx.ed, payload.ed)) {
        throw { status: 400, message: "Coverage end date does not match the reviewed coverage." };
    }

    // Reviewed fare — only when it was actually located in the Review response.
    if (ctx.reviewedAmount != null && Math.abs(amount - Number(ctx.reviewedAmount)) > 0.01) {
        throw {
            status: 400,
            message: `Payment amount does not match the reviewed fare. Reviewed ${ctx.reviewedAmount}, booking ${amount}.`,
        };
    }
}

// ─── Book Service ─────────────────────────────────────────────────────────────

class BookService {
    async book(
        payload: any,
        agentId?: string | null,
        agentName?: string | null,
        clientType?: string | null
    ) {
        // ── Required field validation ───────────────────────────────────────
        if (!payload.bookingId) {
            throw { status: 400, message: "bookingId (from Review API) is required." };
        }
        if (!payload.pli?.length) {
            throw { status: 400, message: "pli (plan list) is required." };
        }
        // Book must echo the single reviewed plan (doc p. 23: "All submitted data
        // must exactly match the information provided in the Insurance Review
        // Request", and Review accepts exactly one plan). Extra plans were booked
        // upstream while only pli[0] was ever persisted below (F-25).
        if (payload.pli.length > 1) {
            throw {
                status: 400,
                message: `Exactly one plan may be booked per review. Received ${payload.pli.length}.`,
            };
        }
        if (payload.pli[0]?.pi?.length > 1) {
            throw {
                status: 400,
                message: `Exactly one product (pid) may be booked per plan. Received ${payload.pli[0].pi.length}.`,
            };
        }
        if (!payload.paymentInfos?.length) {
            throw { status: 400, message: "paymentInfos is required. Use WALLET or CREDIT_LINE." };
        }
        // Doc p. 29: only WALLET and CREDIT_LINE are supported via API, and
        // split payments are not supported — one payment entry only (F-12).
        if (payload.paymentInfos.length > 1) {
            throw { status: 400, message: "Split payments are not supported. Provide exactly one paymentInfos entry." };
        }
        const paymentMedium = String(payload.paymentInfos[0]?.paymentMedium || "").toUpperCase();
        if (paymentMedium !== "WALLET" && paymentMedium !== "CREDIT_LINE") {
            throw { status: 400, message: "paymentMedium must be WALLET or CREDIT_LINE." };
        }
        // deliveryInfo carries the policy delivery address and is mandatory
        // upstream (doc p. 25) (E3).
        if (!payload.deliveryInfo?.emails?.some((e: any) => typeof e === "string" && e.trim())) {
            throw { status: 400, message: "deliveryInfo.emails must contain at least one email address." };
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

        const seenTravellerIds = new Set<number>();
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
                    // Amendment/cancellation travellerKeys are keyed by id — a
                    // duplicate would cancel the wrong passenger (E2). Absence is
                    // tolerated: id is not a documented mandatory field.
                    if (traveller.id !== undefined && traveller.id !== null) {
                        const id = Number(traveller.id);
                        if (seenTravellerIds.has(id)) {
                            throw { status: 400, message: `Duplicate traveller id '${id}'. Traveller ids must be unique.` };
                        }
                        seenTravellerIds.add(id);
                    }
                    // dob drives the issued policy while age drives the price. A
                    // wide gap means the plan was priced for a different person
                    // (B5). Reported, not rejected — clients legitimately compute
                    // age at different reference dates.
                    if (traveller.dob && Number.isFinite(Number(traveller.age))) {
                        const derived = ageFromDob(traveller.dob);
                        if (derived !== null && Math.abs(derived - Number(traveller.age)) > 1) {
                            console.warn(
                                `⚠️  [TripSafe][AGE_DOB_MISMATCH] bookingId=${payload.bookingId} ` +
                                `declaredAge=${traveller.age} ageFromDob=${derived} — priced on the declared age.`
                            );
                        }
                    }
                }
            }
        }

        // ── Verify against the trusted Review context ───────────────────────
        // Fail-open: no context (pre-deploy review, expired TTL, DB down) means
        // Book behaves exactly as it did before this check existed (B1).
        const reviewContext = await InsuranceReviewContextModel
            .findOne({ bid: payload.bookingId })
            .lean()
            .catch((err: any) => {
                console.warn(`⚠️  [TripSafe] Review context unavailable for ${payload.bookingId}: ${err?.message}`);
                return null;
            });

        if (reviewContext) {
            assertMatchesReview(payload, reviewContext, amount);
        }

        // ── Reserve the booking before calling upstream (B4) ─────────────────
        // The unique index on bookingId is enforced by MongoDB across every
        // instance, so a retry of an in-flight booking is refused here instead
        // of creating a second policy upstream.
        // ponytail: keyed on the review bid; if TripJack ever returns a
        // different booking id the reservation is renamed on success and a
        // later retry would no longer collide. Logged as ID_MISMATCH if seen.
        const doc = {
            bookingId: payload.bookingId,
            source: payload.source,
            journeyType,
            planId:    payload.pli?.[0]?.plid,
            productId: payload.pli?.[0]?.pi?.[0]?.pid,
            coverageStart: (reviewContext as any)?.sd ?? (payload.sd ? new Date(payload.sd) : undefined),
            coverageEnd:   (reviewContext as any)?.ed ?? (payload.ed ? new Date(payload.ed) : undefined),
            travellers: collectTravellers(payload),
            amount,
            currencyCode: "INR",
            status: InsuranceBookingStatus.PENDING,
            // Delivery address for the policy, stored normalised so B2C
            // booking history can be looked up by email on an indexed field.
            // Validated as present above, so this is always populated for new
            // bookings; older records fall back to travellers.eid.
            contactEmail: String(payload.deliveryInfo?.emails?.[0] ?? "").trim().toLowerCase() || undefined,
            agentId,
            agentName,
            userId:   agentId   ?? undefined,
            userName: agentName ?? undefined,
            tjBookPayload: payload,
        };

        let reservationId: any = null;
        try {
            const reserved = await InsuranceBookingModel.create(doc);
            reservationId = reserved._id;
        } catch (err: any) {
            if (err?.code === 11000) {
                throw {
                    status: 409,
                    message: "A booking for this review is already in progress or complete.",
                };
            }
            // DB unavailable — proceed unreserved rather than block a paying
            // customer. Behaviour then matches the pre-B4 write path.
            console.error(`⚠️  [TripSafe] Could not reserve ${payload.bookingId} (persistence unavailable): ${err?.message}`);
        }

        // ── Proxy to TripJack ───────────────────────────────────────────────
        let tjResponse: any;
        try {
            tjResponse = await tripJackInsuranceProvider.book(payload);
        } catch (err: any) {
            if (reservationId) {
                // Release only on a definite refusal — a 4xx means TripJack
                // answered and created nothing. The provider synthesises a
                // `response` even for timeouts (status 500), so presence of
                // `response` must NOT be used to decide this.
                const upstreamStatus = Number(err?.status ?? err?.response?.status);
                if (upstreamStatus >= 400 && upstreamStatus < 500) {
                    await InsuranceBookingModel.deleteOne({ _id: reservationId }).catch(() => {});
                } else {
                    // Timeout or network failure: the booking may exist upstream.
                    // Keep the reservation so a retry is refused, and let the
                    // reconciliation sweep settle it from booking-details.
                    console.error(
                        `🚨 [TripSafe][INDETERMINATE_BOOKING] bookingId=${payload.bookingId} amount=${amount} ` +
                        `— upstream outcome unknown (${err?.message}). Reservation kept; awaiting reconciliation.`
                    );
                }
            }
            throw err;
        }

        const tjBookingId: string = tjResponse?.order?.bookingId || payload.bookingId;
        if (tjBookingId !== payload.bookingId) {
            console.warn(
                `⚠️  [TripSafe][BOOKING_ID_MISMATCH] review bid=${payload.bookingId} ` +
                `upstream bookingId=${tjBookingId} — idempotency key renamed.`
            );
        }

        // ── Persist the outcome ─────────────────────────────────────────────
        let persisted = false;
        try {
            if (reservationId) {
                await InsuranceBookingModel.findByIdAndUpdate(reservationId, {
                    bookingId: tjBookingId,
                    tjBookResponse: tjResponse,
                });
            } else {
                await InsuranceBookingModel.create({ ...doc, bookingId: tjBookingId, tjBookResponse: tjResponse });
            }
            persisted = true;
            console.log(`✅ [TripSafe] Saved PENDING booking: ${tjBookingId}`);
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
