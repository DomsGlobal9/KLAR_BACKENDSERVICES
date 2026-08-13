import { tripJackInsuranceProvider } from "../providers/tripjack.insurance.provider";

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

        return {
            status: true,
            statusCode: 200,
            // Expose bookingId at top level for convenience
            bookingId: result?.bid || result?.bookingId || null,
            body: result,
        };
    }
}

export const reviewService = new ReviewService();
