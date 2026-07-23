import axios from "axios";
import { env } from "../config/env";
import { refreshMarkupConfig } from "../config/markup-config";
import { MarkupRegion } from "./region.util";

export interface MarkupRule {
    serviceType: string;
    /** Absent on rules written before regions existed — treat as "ALL". */
    region?: MarkupRegion;
    percentageMarkup: number;
    fixedMarkup: number;
}

/**
 * The markup rules to price a cab with, by channel.
 *
 * B2B — the agent's own rules.
 * B2C / GUEST — the master's B2C rule, expressed as a synthetic agent rule so it
 *       flows through the same pricing path. There is no agent on this channel,
 *       so nothing else would occupy that slot; a B2C caller's own token must
 *       never be allowed to contribute markup rules.
 *
 * Anything not explicitly B2B is B2C. A "GUEST" is a signed-out B2C customer,
 * not a third pricing channel.
 */
export async function resolveMarkupRules(
    clientType: string | undefined,
    token: string,
    region: MarkupRegion = "ALL",
): Promise<MarkupRule[]> {
    const isB2B = (clientType || "").toUpperCase() === "B2B";

    const [config, agentRules] = await Promise.all([
        refreshMarkupConfig(region),
        isB2B ? WalletUtil.getMarkupRules(token) : Promise.resolve([]),
    ]);

    if (isB2B) return pickRulesForRegion(agentRules, region);

    const b2c = config.b2c;
    if (!b2c.enabled || b2c.value <= 0) return [];

    return [
        {
            serviceType: "CABS",
            percentageMarkup: b2c.type === "PERCENTAGE" ? b2c.value : 0,
            fixedMarkup: b2c.type === "FIXED" ? b2c.value : 0,
        },
    ];
}

/**
 * Narrows an agent's rules to those applying to `region`, with the same
 * exact-region-then-ALL precedence auth-service uses for the master config.
 *
 * Without this the first array entry wins, which is whatever order Mongo
 * returned — so an agent's domestic margin could be charged on an
 * international journey.
 */
export function pickRulesForRegion(
    rules: MarkupRule[],
    region: MarkupRegion,
): MarkupRule[] {
    const byService = new Map<string, MarkupRule>();

    for (const rule of rules ?? []) {
        const service = (rule.serviceType || "").toUpperCase();
        const ruleRegion = (rule.region || "ALL").toUpperCase();

        // Ignore rules belonging to a different region entirely.
        if (ruleRegion !== "ALL" && ruleRegion !== region) continue;

        const existing = byService.get(service);
        const existingRegion = existing
            ? (existing.region || "ALL").toUpperCase()
            : null;

        // An exact-region rule beats the ALL catch-all; otherwise first wins.
        if (!existing || (existingRegion === "ALL" && ruleRegion === region)) {
            byService.set(service, rule);
        }
    }

    return [...byService.values()];
}

export class WalletUtil {
    /**
     * Checks if the agent has sufficient internal balance in Klar.
     */
    static async checkInternalBalance(token: string, requiredAmount: number): Promise<{ hasBalance: boolean, balance: number }> {
        try {
            const response = await axios.get(`${env.authServiceUrl}/user/wallet`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data && response.data.success) {
                const balance = response.data.data.balance;
                return { hasBalance: balance >= requiredAmount, balance };
            }
            throw new Error("Failed to fetch internal wallet balance");
        } catch (error: any) {
            console.error("[WalletUtil] Error checking balance:", error.message);
            throw new Error(error.response?.data?.message || "Internal wallet service unavailable");
        }
    }

    /**
     * Deducts balance from the agent's wallet for a booking.
     */
    static async deductBalance(token: string, amount: number, referenceId: string, description: string): Promise<boolean> {
        try {
            console.log(`[WalletUtil] Deducting ₹${amount} for ref: ${referenceId}`);
            const response = await axios.post(`${env.authServiceUrl}/user/wallet/debit`, {
                amount,
                referenceType: "CAB_BOOKING",
                referenceId,
                description
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            return response.data && response.data.success;
        } catch (error: any) {
            const isNetworkError = error.code === "ECONNREFUSED" || error.code === "ENOTFOUND" || error.code === "ECONNRESET";
            const authMessage = error.response?.data?.message;
            const errorMessage = isNetworkError
                ? `Auth service is unreachable (${env.authServiceUrl}). Ensure auth-service is running.`
                : authMessage || "Wallet deduction failed";
            console.error("[WalletUtil] Error deducting balance:", error.response?.data || error.message);
            throw new Error(errorMessage);
        }
    }

    /**
     * Refunds balance to the agent's wallet in case of failure.
     */
    static async refundBalance(token: string, amount: number, referenceId: string, description: string): Promise<boolean> {
        try {
            console.log(`[WalletUtil] Refunding ₹${amount} for ref: ${referenceId}`);
            const response = await axios.post(`${env.authServiceUrl}/user/wallet/credit`, {
                amount,
                type: "REFUND",
                paymentMethod: "WALLET",
                referenceType: "CAB_BOOKING_REFUND",
                referenceId,
                description
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            return response.data && response.data.success;
        } catch (error: any) {
            console.error("[WalletUtil] Error refunding balance:", error.response?.data || error.message);
            return false;
        }
    }

    /**
     * Credit an agent's wallet from a background job (no user JWT available).
     *
     * `refundBalance` credits whoever owns the token it is given — useless to a
     * cron/worker. This hits the shared-secret internal route, which takes the
     * target userId explicitly. Throws on failure so callers never record a
     * refund that did not happen.
     */
    static async refundToAgentWallet(
        agentUserId: string,
        amount: number,
        referenceId: string,
        description: string
    ): Promise<void> {
        const internalKey = process.env.INTERNAL_SERVICE_KEY || "";
        if (!internalKey) {
            throw new Error("INTERNAL_SERVICE_KEY is not configured; cannot issue a wallet refund.");
        }

        const response = await axios.post(
            `${env.authServiceUrl}/user/wallet/internal/credit`,
            {
                userId: agentUserId,
                amount,
                type: "REFUND",
                paymentMethod: "WALLET",
                referenceType: "CAB_BOOKING_REFUND",
                referenceId,
                description,
            },
            { headers: { "x-internal-key": internalKey } }
        );

        if (!response.data?.success) {
            throw new Error(response.data?.message || "Wallet refund was rejected by auth-service");
        }
    }

    /**
     * Fetches the markup rules for the agent.
     */
    static async getMarkupRules(token: string): Promise<MarkupRule[]> {
        try {
            const response = await axios.get(`${env.authServiceUrl}/user/markup/my-markup`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data && response.data.success) {
                // Ensure we handle both array and services object structure
                return Array.isArray(response.data.data) 
                    ? response.data.data 
                    : (response.data.data.services || []);
            }
            return [];
        } catch (error: any) {
            console.error("[WalletUtil] Error fetching markup:", error.message);
            return [];
        }
    }
}
