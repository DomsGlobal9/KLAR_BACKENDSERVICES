import { Types } from "mongoose";

import { MarkupScope, MarkupValueType } from "../models/markup-config.model";
import { MarkupConfigRepository } from "../repositories/markup-config.repository";

export interface ResolvedMarkup {
    type: MarkupValueType;
    value: number;
    enabled: boolean;
}

export interface ResolvedMarkupConfig {
    serviceType: string;
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
};

export function canonicalServiceType(input: string): string {
    const raw = (input || "").toUpperCase().trim();
    return CANONICAL_SERVICE_TYPES[raw] ?? raw;
}

export class MarkupConfigService {

    private repo = new MarkupConfigRepository();

    async getAll() {
        return this.repo.findAll();
    }

    /**
     * Read path for the hotel services. Returns both scopes in one round-trip
     * so search and booking cannot end up holding a half-updated view.
     */
    async resolve(serviceType: string): Promise<ResolvedMarkupConfig> {
        const type = canonicalServiceType(serviceType);

        const [platform, b2c] = await Promise.all([
            this.repo.findOne("PLATFORM", type),
            this.repo.findOne("B2C", type),
        ]);

        const shape = (c: typeof platform): ResolvedMarkup | null =>
            c ? { type: c.type, value: c.value, enabled: c.enabled } : null;

        return {
            serviceType: type,
            platform: shape(platform),
            b2c: shape(b2c),
        };
    }

    async upsert(
        masterId: Types.ObjectId,
        input: {
            scope?: string;
            serviceType?: string;
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
            { type, value, enabled } as any,
            masterId
        );
    }

    async delete(scope: string, serviceType: string) {
        const parsedScope = (scope || "").toUpperCase() as MarkupScope;
        if (!VALID_SCOPES.includes(parsedScope)) {
            throw new Error(`scope must be one of: ${VALID_SCOPES.join(", ")}`);
        }
        const parsedServiceType = canonicalServiceType(serviceType || "");
        if (!parsedServiceType) {
            throw new Error("serviceType is required");
        }
        return this.repo.delete(parsedScope, parsedServiceType);
    }
}
