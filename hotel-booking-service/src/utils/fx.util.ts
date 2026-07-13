import axios from "axios";

/**
 * Currency → INR conversion for foreign-currency hotel rates.
 *
 * Replaces the old hardcoded FX table in pricing.controller. Design goals:
 *   1. Live rates from a configurable provider (FX_API_URL), cached with a TTL
 *      so we don't hit it on every request.
 *   2. A seed table + env override (FX_RATES_JSON) as the offline fallback when
 *      the provider is unreachable.
 *   3. FAIL SAFE: an unknown currency THROWS rather than silently converting
 *      1:1. The old `|| 1` fallback would price a USD hotel as if 1 USD = 1 INR
 *      (an ~83× underprice) — a wrong rate mis-charges the customer, so we would
 *      rather return an error and have them retry.
 *
 * Values are "INR per 1 unit of the currency" (e.g. USD ≈ 83).
 */

// Last-resort seed rates — only used when the live provider is unreachable AND
// no env override is set. They WILL drift; live fetch is always preferred.
const SEED_RATES_TO_INR: Record<string, number> = {
  INR: 1,
  USD: 83,
  EUR: 90,
  GBP: 105,
  AED: 22,
  THB: 2.3,
  SGD: 62,
  AUD: 55,
  CAD: 61,
  JPY: 0.56,
  MYR: 18,
  HKD: 10.6,
};

// open.er-api.com is free and key-less; base=INR returns "X per 1 INR" rates.
const FX_API_URL =
  process.env.FX_API_URL || "https://open.er-api.com/v6/latest/INR";
const TTL_MS = Number(process.env.FX_CACHE_TTL_MS || 6 * 60 * 60 * 1000); // 6h
const FETCH_TIMEOUT_MS = Number(process.env.FX_FETCH_TIMEOUT_MS || 8000);

interface FxCache {
  at: number;
  rates: Record<string, number>;
}
let cache: FxCache | null = null;

function loadEnvRates(): Record<string, number> {
  try {
    if (process.env.FX_RATES_JSON) {
      const parsed = JSON.parse(process.env.FX_RATES_JSON);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, number>;
      }
    }
  } catch {
    console.warn("[FX] FX_RATES_JSON is not valid JSON; ignoring it.");
  }
  return {};
}

async function fetchLiveRatesToINR(): Promise<Record<string, number> | null> {
  try {
    const res = await axios.get(FX_API_URL, { timeout: FETCH_TIMEOUT_MS });
    const data = res.data;
    const base = (data?.base_code || data?.base || "INR").toUpperCase();
    const ratesRaw = data?.rates || data?.conversion_rates;
    if (!ratesRaw || typeof ratesRaw !== "object") return null;

    // `ratesRaw[cur]` = units of `cur` per 1 `base`. To express 1 `cur` in INR:
    //   base==INR → 1 cur = 1/rate INR
    //   otherwise → 1 cur = (INR-per-base) / rate  INR
    const inrPerBase = base === "INR" ? 1 : Number(ratesRaw.INR);
    if (!isFinite(inrPerBase) || inrPerBase <= 0) return null;

    const toINR: Record<string, number> = { INR: 1 };
    for (const [cur, rate] of Object.entries(ratesRaw)) {
      const r = Number(rate);
      if (!isFinite(r) || r <= 0) continue;
      toINR[cur.toUpperCase()] = inrPerBase / r;
    }
    return toINR;
  } catch (err: any) {
    console.warn(`[FX] Live rate fetch failed: ${err?.message}`);
    return null;
  }
}

async function getRatesToINR(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.rates;

  const live = await fetchLiveRatesToINR();
  if (live && Object.keys(live).length > 1) {
    // Env overrides win over live; seed fills any gap the provider doesn't cover.
    cache = {
      at: now,
      rates: { ...SEED_RATES_TO_INR, ...live, ...loadEnvRates() },
    };
    return cache.rates;
  }

  // Provider unavailable — serve seed+env, but cache only briefly so we retry
  // the live provider soon instead of being stuck on stale fallbacks for 6h.
  const fallback = { ...SEED_RATES_TO_INR, ...loadEnvRates() };
  const shortTtl = Math.min(TTL_MS, 10 * 60 * 1000); // ~10 min
  cache = { at: now - (TTL_MS - shortTtl), rates: fallback };
  return fallback;
}

/**
 * Convert `amount` in `currency` to INR. Throws if no rate is available for a
 * non-INR currency (never silently returns a 1:1 conversion).
 */
export async function convertToINR(
  amount: number,
  currency = "INR",
): Promise<number> {
  const cur = (currency || "INR").toUpperCase();
  const amt = Number(amount) || 0;
  if (cur === "INR") return amt;

  const rates = await getRatesToINR();
  const rate = rates[cur];
  if (!rate || !isFinite(rate) || rate <= 0) {
    throw new Error(
      `No FX rate available for ${cur}; cannot price this hotel safely.`,
    );
  }
  return amt * rate;
}
