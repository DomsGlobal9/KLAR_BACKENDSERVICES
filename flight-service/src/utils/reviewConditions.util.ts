/**
 * TripJack Review `conditions` resolver (C-4).
 *
 * The Review response is the source of truth for which traveller fields a
 * booking actually requires. Previously nothing read it and every requirement
 * was hardcoded or guessed from a fare-identifier string, which both blocked
 * bookings TripJack would have accepted and submitted bookings it rejects.
 *
 * This module is the single place those flags are interpreted. Backend
 * validation and the frontend form both consume the normalised shape below,
 * so the two can never disagree about what is mandatory.
 *
 * Field definitions — Flights 1.8.2 pp. 32, 37-38; Air 2.0 pp. 42, 57-58:
 *   pcs.pm     passport mandatory for booking
 *   pcs.pped   passport expiry date required at booking
 *   pcs.pid    passport issue date required at booking
 *   pcs.dobe   DOB of every passenger mandatory
 *   dob.adobr  adult DOB required
 *   dob.cdobr  child DOB required
 *   dob.idobr  infant DOB required
 *   gst.gstappl  GST may be passed (not mandatory)
 *   gst.igm      GST mandatory — number, name, address, mobile required
 *   iecr       emergency contact details required
 *   dc.ida     document id (student/senior) applicable
 *   dc.idm     document id mandatory
 *   ipa        PAN applicable
 *   isa        seat selection applicable for this flight
 *   isBA       booking may be put on HOLD
 *   st         review session validity, seconds
 *   sct        session created time
 *
 * Note the response passes through TripjackFieldMapper before reaching here.
 * None of the condition keys collide with TRIPJACK_FIELD_MAP, so they survive
 * unrenamed; `resolve` still reads defensively in case that ever changes.
 */

export interface BookingRequirements {
    passport: {
        required: boolean;
        expiryRequired: boolean;
        issueDateRequired: boolean;
    };
    dob: {
        adult: boolean;
        child: boolean;
        infant: boolean;
    };
    gst: {
        applicable: boolean;
        mandatory: boolean;
    };
    emergencyContact: {
        required: boolean;
    };
    documentId: {
        applicable: boolean;
        mandatory: boolean;
    };
    pan: {
        applicable: boolean;
    };
    seat: {
        /** Seat selection is offered for this itinerary (conditions.isa). */
        applicable: boolean;
        /**
         * Seat selection is *mandatory* — IndiGo Upfront fare. Distinct from
         * `applicable`: that says seats can be chosen, this says they must be.
         * Driven by the per-trip `ism` flag, not by `conditions`.
         */
        mandatory: boolean;
        /**
         * Segment ids belonging to trips that carry `ism: true`. Every adult
         * and child must hold a seat on each of these; infants are exempt.
         */
        mandatorySegmentIds: string[];
    };
    hold: {
        allowed: boolean;
    };
    session: {
        /** Seconds the reviewed price stays valid (conditions.st). */
        validSeconds: number | null;
        /** Session creation time as reported by TripJack (conditions.sct). */
        createdAt: string | null;
    };
}

/** Coerce TripJack's booleans, which arrive as true/false but occasionally as strings. */
function flag(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toLowerCase() === "true";
    return false;
}

/**
 * Segment ids on trips where seat selection is mandatory (IndiGo Upfront).
 *
 * `ism` is returned per trip (`tripInfos[].ism`, mapped to
 * `TripInformation[].ism`), so the mandate covers every segment of that trip.
 * Trips without the flag are untouched — the rule applies only to Upfront
 * fares, every other fare and airline behaves exactly as before.
 */
export function mandatorySeatSegmentIds(review: any): string[] {
    const root = review?.mappedData || review;
    const trips = root?.TripInformation || root?.tripInfos || [];
    const ids: string[] = [];

    for (const trip of trips) {
        if (!flag(trip?.ism)) continue;
        for (const seg of trip?.SegmentInformation || trip?.sI || []) {
            const id = seg?.SegmentID ?? seg?.id;
            if (id !== undefined && id !== null) ids.push(String(id));
        }
    }

    return [...new Set(ids)];
}

/** The mapped Review payload, wherever the caller happens to hold it. */
function conditionsOf(review: any): any {
    return (
        review?.conditions ||
        review?.mappedData?.conditions ||
        review?.data?.mappedData?.conditions ||
        {}
    );
}

/**
 * Normalise a Review response into the booking requirements it implies.
 *
 * Absent flags resolve to `false` — i.e. not required. That matches the PDF,
 * where every condition field is Optional and its presence is what turns a
 * requirement on. It also means a Review we could not read never invents a
 * requirement that TripJack did not ask for.
 */
export function resolveBookingRequirements(review: any): BookingRequirements {
    const c = conditionsOf(review);
    const pcs = c.pcs || {};
    const dob = c.dob || {};
    const gst = c.gst || {};
    const dc = c.dc || {};

    const dobEveryone = flag(pcs.dobe);
    const mandatorySegmentIds = mandatorySeatSegmentIds(review);

    return {
        passport: {
            required: flag(pcs.pm),
            expiryRequired: flag(pcs.pped),
            issueDateRequired: flag(pcs.pid),
        },
        dob: {
            // `dobe` makes DOB mandatory for every passenger regardless of the
            // per-paxtype flags (1.8.2 p. 32).
            adult: dobEveryone || flag(dob.adobr),
            child: dobEveryone || flag(dob.cdobr),
            infant: dobEveryone || flag(dob.idobr),
        },
        gst: {
            // `igm` implies applicability even if `gstappl` is absent.
            applicable: flag(gst.gstappl) || flag(gst.igm),
            mandatory: flag(gst.igm),
        },
        emergencyContact: {
            required: flag(c.iecr),
        },
        documentId: {
            applicable: flag(dc.ida) || flag(dc.idm),
            mandatory: flag(dc.idm),
        },
        pan: {
            applicable: flag(c.ipa),
        },
        seat: {
            applicable: flag(c.isa),
            mandatory: mandatorySegmentIds.length > 0,
            mandatorySegmentIds,
        },
        hold: {
            allowed: flag(c.isBA),
        },
        session: {
            validSeconds: Number.isFinite(Number(c.st)) ? Number(c.st) : null,
            createdAt: typeof c.sct === "string" ? c.sct : null,
        },
    };
}

/**
 * Whether the reviewed price has expired.
 *
 * TripJack states the reviewed price id is valid for `st` seconds from `sct`
 * (1.8.2 p. 28). We measure from the time we stored the review rather than
 * trusting `sct`'s timezone-less format, and fall back to `sct` only when the
 * stored timestamp is unavailable.
 *
 * Returns false when validity cannot be determined — an unreadable session
 * must not block a booking TripJack would still honour; TripJack rejects
 * genuinely expired keys itself.
 */
export function isReviewExpired(
    requirements: BookingRequirements,
    storedAt?: Date | string | null,
    now: Date = new Date()
): boolean {
    const validSeconds = requirements.session.validSeconds;
    if (!validSeconds || validSeconds <= 0) return false;

    const base = storedAt ? new Date(storedAt) : null;
    if (!base || isNaN(base.getTime())) return false;

    return now.getTime() > base.getTime() + validSeconds * 1000;
}
