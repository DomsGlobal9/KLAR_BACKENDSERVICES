import { tripJackInsuranceProvider } from "../providers/tripjack.insurance.provider";
import { InsuranceReviewContextModel } from "../models/InsuranceReviewContext.model";

/**
 * Locate the reviewed total fare in a Review response.
 *
 * The doc lists TF (Total Fare) under the insurance fare component but shows no
 * complete Review response body, and the Postman collection stores no example
 * responses. Rather than guess a single path, try the shapes that are evidenced
 * elsewhere in the doc (tfd.ifc.TF in the amendment response, ptf in the student
 * search response) and return null when none is present — a null amount simply
 * means Book skips the amount comparison (B2).
 */
export function extractReviewedAmount(res: any): number | null {
    const product = res?.isr?.iinfo?.pli?.[0]?.pi?.[0];
    // Only `tfd` — "total fare details" — is evidenced as the payable total
    // (amendment response: tfd.ifc.TF 1610 equals the cancellation amount).
    // `ptf` is deliberately NOT used: the student search sample shows ptf 9050
    // against a per-traveller TF of 8200, so it is a different figure and using
    // it would reject legitimate bookings on a false mismatch.
    const candidates = [
        product?.tfd?.ifc?.TF,
        res?.tfd?.ifc?.TF,
    ];
    for (const c of candidates) {
        const n = Number(c);
        if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
}

/** Travellers (ages/DOB) as established by Review, from the response or the request. */
function extractReviewTravellers(res: any, payload: any): any[] {
    const fromResponse = res?.isq?.iti;
    const iti: any[] = Array.isArray(fromResponse) && fromResponse.length
        ? fromResponse
        : (Array.isArray(payload?.iti) ? payload.iti : []);

    return iti.map((t: any) => ({
        id:  t?.id  !== undefined ? Number(t.id)  : undefined,
        age: t?.age !== undefined ? Number(t.age) : undefined,
        dob: t?.dob,
    }));
}

function toDate(value: any): Date | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
}

class ReviewService {
    /**
     * Review selected plan/product → returns bid (bookingId) used in Book API.
     *
     * Standard payload:  { pli: [{ plid, pi: [{ pid }] }] }
     * Embedded payload:  { iid, pid, refid, sd, ed, iti: [...] }
     */
    async review(payload: any) {
        // ── Basic validation ─────────────────────────────────────────────────
        // Standard review path
        if (payload.pli) {
            const pli: any[] = payload.pli;
            if (!pli.length) {
                throw { status: 400, message: "pli array must contain at least one plan." };
            }
            // TripSafe v6.0 Review FAQ (p. 21): "Can multiple plans from different
            // providers be reviewed simultaneously in the pli array? — No, we can
            // review only 1 plid, per search." A multi-plan review has no single
            // bid to book against (F-24).
            if (pli.length > 1) {
                throw {
                    status: 400,
                    message: `Exactly one plan may be reviewed per search. Received ${pli.length}.`,
                };
            }
            for (const plan of pli) {
                if (!plan.plid) {
                    throw { status: 400, message: "Each plan in pli must have a plid." };
                }
                if (!plan.pi?.length || !plan.pi[0]?.pid) {
                    throw { status: 400, message: `Plan ${plan.plid} must include at least one pid in pi.` };
                }
                // Doc p. 21: "we choose the pid corresponding to plid" — one
                // product is selected per plan, as in the AIR price-id flow (E1).
                if (plan.pi.length > 1) {
                    throw {
                        status: 400,
                        message: `Exactly one product (pid) may be reviewed per plan. Plan ${plan.plid} has ${plan.pi.length}.`,
                    };
                }
            }
        }
        // Embedded review path
        else if (payload.iid || payload.pid || payload.refid) {
            if (!payload.pid)   throw { status: 400, message: "pid is required for embedded review." };
            if (!payload.iid)   throw { status: 400, message: "iid is required for embedded review." };
            if (!payload.refid) throw { status: 400, message: "refid (Air Booking ID) is required for embedded review." };
            if (!payload.iti?.length) throw { status: 400, message: "iti (traveller info) is required for embedded review." };
            if (!payload.sd || !payload.ed) throw { status: 400, message: "sd and ed (coverage dates) are required for embedded review." };
        }
 else {
            throw { status: 400, message: "Review payload must include pli (standard) or iid+pid (embedded)." };
        }

        const result = await tripJackInsuranceProvider.review(payload);

        const bid: string | null = result?.bid || result?.bookingId || null;

        // ── Capture trusted context for Book (B1) ────────────────────────────
        // Best-effort: a persistence failure must never fail a successful Review.
        if (bid) {
            await this.saveContext(bid, payload, result);
        }

        return {
            status: true,
            statusCode: 200,
            // Expose bookingId at top level for convenience
            bookingId: bid,
            body: result,
        };
    }

    private async saveContext(bid: string, payload: any, result: any): Promise<void> {
        try {
            const travellers = extractReviewTravellers(result, payload);
            await InsuranceReviewContextModel.findOneAndUpdate(
                { bid },
                {
                    bid,
                    plid: payload.pli?.[0]?.plid || payload.iid,
                    pid:  payload.pli?.[0]?.pi?.[0]?.pid || payload.pid,
                    travellerCount: travellers.length,
                    travellers,
                    sd: toDate(result?.sd || result?.isq?.sd || payload.sd),
                    ed: toDate(result?.ed || result?.isq?.ed || payload.ed),
                    reviewedAmount: extractReviewedAmount(result),
                    createdAt: new Date(),
                },
                { upsert: true, new: true }
            );
        } catch (err: any) {
            console.error(`⚠️  [TripSafe] Could not store review context for ${bid}: ${err?.message}`);
        }
    }
}

export const reviewService = new ReviewService();
