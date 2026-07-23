import { Request } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import axios from "axios";
import { env } from "../config/env";
import { MarkupRule } from "./pricing.util";
import { LruCache } from "./lruCache";
import { refreshMarkupConfig } from "../config/markup-config";
import { MarkupRegion } from "./region.util";

export function getClientType(req: Request): "B2B" | "B2C" {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader) {
      const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
      token = bearerMatch ? bearerMatch[1] : authHeader;
    } else if (req.query?.token && typeof req.query.token === "string") {
      token = req.query.token;
    }

    if (token) {
      const decoded = jwt.verify(token, env.jwtSecret) as any;
      if (decoded && decoded.clientType?.toUpperCase() === "B2B") {
        return "B2B";
      }
    }
  } catch (err) {
    // Ignore and fallback to B2C
  }
  return "B2C";
}

/**
 * Extracts the bearer token (or raw token) from an Express request.
 * Priority: Authorization header (Bearer prefix) → raw header value → query.token
 * Returns null if no token can be found.
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    return bearerMatch ? bearerMatch[1] : authHeader;
  }

  if (req.query?.token && typeof req.query.token === "string") {
    return req.query.token;
  }

  return null;
}

/**
 * Every hotel search and every hotel-detail request needs the caller's markup
 * rules before it can price anything, so this call sits at the head of both
 * critical paths. An agent's markup changes on the order of days, so a short
 * memoisation removes an auth-service round-trip from each of them.
 */
const MARKUP_TTL_MS = Number(process.env.MARKUP_CACHE_TTL_MS || 60_000);
const MARKUP_TIMEOUT_MS = Number(process.env.MARKUP_TIMEOUT_MS || 3_000);
/** Failures are remembered only briefly, so an auth-service blip can't strip an agent's markup for a full minute. */
const MARKUP_FAILURE_TTL_MS = 5_000;

const markupCache = new LruCache<MarkupRule[]>(500, MARKUP_TTL_MS);
const markupFailureCache = new LruCache<true>(500, MARKUP_FAILURE_TTL_MS);

const tokenKey = (token: string) =>
  crypto.createHash("sha1").update(token).digest("hex");

/**
 * Fetches the agent's markup rules from the auth service.
 * Returns an empty array if the token is null/undefined, on network error, or on any failure.
 * Never throws.
 */
export async function getMarkupRules(
  token: string | null,
): Promise<MarkupRule[]> {
  if (!token) {
    return [];
  }

  const key = tokenKey(token);

  const cached = markupCache.get(key);
  if (cached) return cached;

  // The auth service is down or slow; don't make every request in flight wait
  // out the timeout again.
  if (markupFailureCache.get(key)) return [];

  try {
    const response = await axios.get(
      `${env.authServiceUrl}/user/markup/my-markup`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: MARKUP_TIMEOUT_MS,
      },
    );

    if (response.data?.success) {
      const rules: MarkupRule[] = Array.isArray(response.data.data)
        ? response.data.data
        : response.data.data?.services || [];
      markupCache.set(key, rules);
      return rules;
    }

    markupCache.set(key, []);
    return [];
  } catch (err: any) {
    console.warn("[auth] getMarkupRules failed:", err?.message ?? err);
    markupFailureCache.set(key, true);
    return [];
  }
}

/**
 * The markup rules to price a request with, by channel.
 *
 * B2B — the agent's own rules. The platform markup is already folded into the
 *       net they see, so their rule stacks on top of it.
 * B2C — the master's B2C rule, expressed as a synthetic agent rule so it flows
 *       through the same `calculateEnrichedPricing` path. There is no agent in
 *       this channel, so nothing else would occupy that slot; a B2C caller's
 *       token must never be allowed to contribute markup rules of its own.
 *
 * Also refreshes the master config snapshot, which every downstream sync call
 * to `platformMarkupAmount()` depends on. Both hotel search and hotel detail
 * route through here, which is what keeps that guarantee cheap to hold.
 */
export async function resolveMarkupRules(
  clientType: "B2B" | "B2C",
  token: string | null,
  region: MarkupRegion = "ALL",
): Promise<MarkupRule[]> {
  const [config, agentRules] = await Promise.all([
    refreshMarkupConfig(region),
    clientType === "B2B" ? getMarkupRules(token) : Promise.resolve([]),
  ]);

  if (clientType === "B2B") return pickRulesForRegion(agentRules, region);

  const b2c = config.b2c;
  if (!b2c.enabled || b2c.value <= 0) return [];

  return [
    {
      serviceType: "HOTEL",
      percentageMarkup: b2c.type === "PERCENTAGE" ? b2c.value : 0,
      fixedMarkup: b2c.type === "FIXED" ? b2c.value : 0,
    },
  ];
}

/**
 * Narrows an agent's rules to the ones that apply to `region`, using the same
 * exact-region-then-ALL precedence auth-service applies to the master config.
 *
 * An agent may hold several rules for one serviceType (one per region); without
 * this the first array entry would win, which is whatever order Mongo returned.
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
