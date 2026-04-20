import { tripJackInsuranceProvider } from "../providers/tripjack.insurance.provider";

// ─── Blacklisted country codes (per TripSafe docs §4) ────────────────────────
const BLACKLISTED_COUNTRIES = new Set(["MM", "IR", "NK"]);

// ─── Valid AMT duration values ────────────────────────────────────────────────
const AMT_VALID_DURATIONS = new Set([30, 45, 60]);

// ─── Valid Student coverage durations (cd) ───────────────────────────────────
const STUDENT_VALID_DURATIONS = new Set([30, 60, 90, 120, 180, 240, 270, 365, 730, 1095]);

class SearchService {
    /**
     * Validate + proxy Insurance Search to TripJack.
     * Handles all journey types: STANDALONE, STUDENT, AMT, EMBEDDED (API_EMB)
     */
    async search(rawPayload: any) {
        const isq = rawPayload.isq || rawPayload;

        // ── Determine journey type ──────────────────────────────────────────
        const ict: string = (isq.ict || "").toUpperCase();
        const journeyType = ict === "STUDENT"  ? "STUDENT"
                          : ict === "AMT"      ? "AMT"
                          : ict === "API_EMB"  ? "EMBEDDED"
                          : "STANDALONE";

        // ── Travellers validation ───────────────────────────────────────────
        const travellers: any[] = isq.iti || [];
        if (!travellers.length) {
            throw { status: 400, message: "At least one traveller (iti) is required." };
        }
        if (travellers.length > 10) {
            throw { status: 400, message: "Maximum 10 travellers allowed per request." };
        }

        // ── Age validation ──────────────────────────────────────────────────
        for (const t of travellers) {
            const age = Number(t.age);
            if (!Number.isInteger(age)) {
                throw { status: 400, message: "Traveller age must be an integer." };
            }
            if (journeyType === "STUDENT") {
                if (age < 18 || age > 45) {
                    throw { status: 400, message: `Student plan: age must be 18–45. Got ${age}.` };
                }
            } else {
                if (age < 0 || age > 75) {
                    throw { status: 400, message: `Age must be 0–75. Got ${age}.` };
                }
            }
        }

        // ── Journey constraints validation (Search Matrix Page 89) ──────────
        const regions: any[] = isq.isc?.iri || [];
        if (journeyType === "STUDENT") {
            const hasNonCountry = regions.some(r => r.rt !== "COUNTRY");
            if (hasNonCountry) {
                throw { status: 400, message: "Student insurance search is allowed for COUNTRY only (rt: COUNTRY)." };
            }
        } else if (journeyType === "AMT") {
            const hasNonRegion = regions.some(r => r.rt !== "POPULARREGION");
            if (hasNonRegion) {
                throw { status: 400, message: "AMT insurance search is allowed for REGION only (rt: POPULARREGION)." };
            }
        }

        // ── Blacklisted country check ───────────────────────────────────────
        for (const r of regions) {
            if (r.rt === "COUNTRY" && BLACKLISTED_COUNTRIES.has((r.rkey || "").toUpperCase())) {
                throw { status: 400, message: `Country ${r.rkey} is blacklisted for TripSafe (Myanmar, Iran, North Korea).` };
            }
        }

        // ── Date / duration validation ──────────────────────────────────────
        if (journeyType === "AMT") {
            const adr = Number(isq.adr);
            if (!AMT_VALID_DURATIONS.has(adr)) {
                throw { status: 400, message: `AMT: adr must be one of 30, 45, 60. Got ${adr}.` };
            }
        } else if (journeyType === "STUDENT") {
            const cd = Number(isq.cd);
            if (!STUDENT_VALID_DURATIONS.has(cd)) {
                throw {
                    status: 400,
                    message: `Student: cd must be one of ${[...STUDENT_VALID_DURATIONS].join(", ")}. Got ${cd}.`,
                };
            }
            if (!isq.sd) {
                throw { status: 400, message: "Student: sd (start date) is required." };
            }
        } else {
            // STANDALONE / EMBEDDED
            if (!isq.sd || !isq.ed) {
                throw { status: 400, message: "sd (start date) and ed (end date) are required." };
            }
            const start = new Date(isq.sd);
            const end   = new Date(isq.ed);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                throw { status: 400, message: "Invalid date format. Use YYYY-MM-DD." };
            }
            if (end < start) {
                throw { status: 400, message: "ed (end date) must be after sd (start date)." };
            }
            const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
            if (diffDays > 180) {
                throw { status: 400, message: `Coverage duration cannot exceed 180 days. Got ${diffDays}.` };
            }
        }

        // ── Proxy to TripJack ───────────────────────────────────────────────
        // Wrap in { isq: ... } if the caller sent the raw isq fields
        const tjPayload = rawPayload.isq ? rawPayload : { isq: rawPayload };
        const result = await tripJackInsuranceProvider.search(tjPayload);

        return {
            status: true,
            statusCode: 200,
            journeyType,
            body: result,
        };
    }
}

export const searchService = new SearchService();
