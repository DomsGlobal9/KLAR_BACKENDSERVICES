import { Types } from "mongoose";

import {
    MARKUP_REGIONS,
    MarkupRegion,
    MarkupScope,
    MarkupValueType,
} from "../models/markup-config.model";
import { MarkupConfigRepository } from "../repositories/markup-config.repository";

export interface ResolvedMarkup {
    type: MarkupValueType;
    value: number;
    enabled: boolean;
}

export interface ResolvedMarkupConfig {
    serviceType: string;
    /** The region the caller asked for, echoed back so a stale/typo'd value is
     *  visible to the consumer rather than silently treated as ALL. */
    region: MarkupRegion;
    /** null means "the master has never configured this", which is NOT the same
     *  as a configured-but-disabled rule. Callers fall back to their env
     *  defaults on null and to zero on disabled — see the hotel-service
     *  resolver. Collapsing the two here would silently zero the platform
     *  margin on first deploy. */
    platform: ResolvedMarkup | null;
    b2c: ResolvedMarkup | null;
}

const VALID_SCOPES: MarkupScope[] = ["PLATFORM", "B2C"];
const VALID_TYPES: MarkupValueType[] = ["FIXED", "PERCENTAGE"];

/**
 * serviceType has two spellings in the wild: the UI and the agent-markup API
 * say "HOTELS", the hotel services resolve on "HOTEL". Every consumer of the
 * agent `Markup` collection carries its own HOTEL/HOTELS alias check for this
 * reason.
 *
 * Rather than spread that here too, canonicalise on the way in and on the way
 * out, so the collection only ever holds one spelling. Skipping this is not a
 * cosmetic bug: a config saved as HOTELS is never found by a resolve for HOTEL,
 * so the master's markup silently evaluates to zero — and because the markup is
 * invisible to agents by design, nothing downstream would ever report it.
 */
const CANONICAL_SERVICE_TYPES: Record<string, string> = {
    HOTELS: "HOTEL",
    HOTEL: "HOTEL",
    FLIGHTS: "FLIGHT",
    FLIGHT: "FLIGHT",
    // Cabs arrive as CAB, CABS or CABSERVICES depending on the caller. Every
    // spelling must fold to one row for the same reason HOTEL/HOTELS does: a
    // config saved as CABS is never found by a resolve for CAB, so the markup
    // evaluates to zero and — being invisible to agents by design — nothing
    // downstream ever reports it.
    CABS: "CABS",
    CAB: "CABS",
    CABSERVICES: "CABS",
    CAB_SERVICES: "CABS",
};

export function canonicalServiceType(input: string): string {
    const raw = (input || "").toUpperCase().trim();
    return CANONICAL_SERVICE_TYPES[raw] ?? raw;
}

/**
 * Region names, normalised. An absent or unrecognised value means ALL — the
 * catch-all — so a caller that has not been taught about regions yet keeps
 * resolving exactly what it did before.
 */
export function canonicalRegion(input?: string | null): MarkupRegion {
    const raw = (input || "").toUpperCase().trim();
    if (raw === "DOM") return "DOMESTIC";
    if (raw === "INTL" || raw === "INTERNATIONAL") return "INTERNATIONAL";
    return (MARKUP_REGIONS as string[]).includes(raw)
        ? (raw as MarkupRegion)
        : "ALL";
}

export class MarkupConfigService {

    private repo = new MarkupConfigRepository();

    async getAll() {
        return this.repo.findAll();
    }

    /**
     * Read path for the hotel and cab services. Returns both scopes in one
     * round-trip so search and booking cannot end up holding a half-updated
     * view.
     *
     * `region` selects which rule applies. A rule written for the exact region
     * wins; otherwise the ALL rule (which is what every pre-region row migrated
     * to) is used. Returning null still means "never configured" — callers fall
     * back to their env defaults on null and to zero on a configured-but-
     * disabled rule, and collapsing the two would silently zero the margin.
     */
    async resolve(
        serviceType: string,
        region?: string
    ): Promise<ResolvedMarkupConfig> {
        const type = canonicalServiceType(serviceType);
        const wanted = canonicalRegion(region);

        const [platform, b2c] = await Promise.all([
            this.resolveScope("PLATFORM", type, wanted),
            this.resolveScope("B2C", type, wanted),
        ]);

        return { serviceType: type, region: wanted, platform, b2c };
    }

    /** Exact-region rule first, then the ALL catch-all. */
    private async resolveScope(
        scope: MarkupScope,
        serviceType: string,
        region: MarkupRegion
    ): Promise<ResolvedMarkup | null> {
        const shape = (c: any): ResolvedMarkup | null =>
            c ? { type: c.type, value: c.value, enabled: c.enabled } : null;

        if (region !== "ALL") {
            const exact = await this.repo.findOne(scope, serviceType, region);
            // A disabled exact rule is a decision ("no margin on this region"),
            // not a miss — do NOT fall through to ALL and reinstate a margin
            // the master just turned off.
            if (exact) return shape(exact);
        }

        return shape(await this.repo.findOne(scope, serviceType, "ALL"));
    }

    async upsert(
        masterId: Types.ObjectId,
        input: {
            scope?: string;
            serviceType?: string;
            region?: string;
            type?: string;
            value?: unknown;
            enabled?: unknown;
        }
    ) {
        const scope = (input.scope || "").toUpperCase() as MarkupScope;
        if (!VALID_SCOPES.includes(scope)) {
            throw new Error(`scope must be one of: ${VALID_SCOPES.join(", ")}`);
        }

        // Canonicalised on write so "HOTELS" from the UI and "HOTEL" from a
        // resolve address the same row.
        const serviceType = canonicalServiceType(input.serviceType || "");
        if (!serviceType) {
            throw new Error("serviceType is required");
        }

        // Unlike a resolve, a WRITE must not silently coerce a typo to ALL:
        // that would quietly create a catch-all rule covering every journey
        // when the master meant to target one region.
        if (
            input.region !== undefined &&
            input.region !== null &&
            String(input.region).trim() !== "" &&
            !(MARKUP_REGIONS as string[]).includes(
                String(input.region).toUpperCase().trim()
            )
        ) {
            throw new Error(
                `region must be one of: ${MARKUP_REGIONS.join(", ")}`
            );
        }
        const region = canonicalRegion(input.region);

        const type = (input.type || "FIXED").toUpperCase() as MarkupValueType;
        if (!VALID_TYPES.includes(type)) {
            throw new Error(`type must be one of: ${VALID_TYPES.join(", ")}`);
        }

        // Number("") is 0 and Number(null) is 0, either of which would quietly
        // wipe a live markup on a malformed request. Demand a real number.
        const value = Number(input.value);
        if (!Number.isFinite(value) || value < 0) {
            throw new Error("value must be a non-negative number");
        }
        if (type === "PERCENTAGE" && value > 100) {
            throw new Error(
                `Percentage markup ${value}% exceeds the 100% ceiling. If you meant a flat amount, set type=FIXED.`
            );
        }

        const enabled = input.enabled === true || input.enabled === "true";

        return this.repo.upsert(
            scope,
            serviceType,
            region,
            { type, value, enabled } as any,
            masterId
        );
    }

    async delete(scope: string, serviceType: string, region?: string) {
        const parsedScope = (scope || "").toUpperCase() as MarkupScope;
        if (!VALID_SCOPES.includes(parsedScope)) {
            throw new Error(`scope must be one of: ${VALID_SCOPES.join(", ")}`);
        }
        const parsedServiceType = canonicalServiceType(serviceType || "");
        if (!parsedServiceType) {
            throw new Error("serviceType is required");
        }
        return this.repo.delete(
            parsedScope,
            parsedServiceType,
            canonicalRegion(region)
        );
    }
}
