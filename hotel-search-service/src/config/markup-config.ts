/**
 * Master-owned markup configuration, resolved from auth-service.
 *
 * WHY A SNAPSHOT AND NOT AN AWAIT
 * -------------------------------
 * The platform markup is consumed by `platformMarkupAmount()` deep inside the
 * sync adapter/normaliser call tree (per rate, per room, per hotel — thousands
 * of calls per search). Making those async would turn the whole pricing path
 * red for no benefit, since the config is global rather than per-request.
 * Instead the request head awaits `refreshMarkupConfig()` once, and every sync
 * reader downstream sees a consistent snapshot for the rest of that request.
 *
 * FAILURE SEMANTICS
 * -----------------
 * This value is money. Returning 0 because auth-service blinked means selling
 * at supplier net — a silent, unbounded loss that nobody downstream would
 * report, because agents cannot see the platform markup by design. So we
 * degrade in this order and never to zero-by-accident:
 *
 *   fresh cache  ->  live fetch  ->  STALE cache  ->  env defaults
 *
 * A rule the master has explicitly saved with `enabled: false` is a decision,
 * not a failure, and does yield zero. That is why auth-service distinguishes
 * "never configured" (null -> env fallback) from "configured off".
 */

import axios from "axios";

import { env } from "./env";

export interface ResolvedMarkup {
  type: "FIXED" | "PERCENTAGE";
  value: number;
  enabled: boolean;
}

export interface MarkupConfigSnapshot {
  platform: ResolvedMarkup;
  b2c: ResolvedMarkup;
}

const CONFIG_TTL_MS = Number(process.env.MARKUP_CONFIG_TTL_MS || 60_000);
const CONFIG_TIMEOUT_MS = Number(process.env.MARKUP_CONFIG_TIMEOUT_MS || 3_000);
const SERVICE_TYPE = "HOTEL";

/**
 * Pre-existing env vars, now the bootstrap/fallback rather than the source of
 * truth. Keeping them load-bearing means a deploy that cannot reach
 * auth-service prices exactly as it does today instead of collapsing to net.
 */
const envPlatformMarkup = (): ResolvedMarkup => ({
  enabled: (process.env.PLATFORM_MARKUP_ENABLED || "false") === "true",
  type:
    (process.env.PLATFORM_MARKUP_TYPE || "FIXED").toUpperCase() === "PERCENTAGE"
      ? "PERCENTAGE"
      : "FIXED",
  value: Number(process.env.PLATFORM_MARKUP_VALUE || 0),
});

const envB2cMarkup = (): ResolvedMarkup => ({
  enabled: (process.env.B2C_MARKUP_ENABLED || "false") === "true",
  type:
    (process.env.B2C_MARKUP_TYPE || "FIXED").toUpperCase() === "PERCENTAGE"
      ? "PERCENTAGE"
      : "FIXED",
  value: Number(process.env.B2C_MARKUP_VALUE || 0),
});

let snapshot: MarkupConfigSnapshot = {
  platform: envPlatformMarkup(),
  b2c: envB2cMarkup(),
};

let fetchedAt = 0;
/** Deduplicates the refresh across the concurrent requests of a burst. */
let inFlight: Promise<void> | null = null;

const isFresh = () => fetchedAt > 0 && Date.now() - fetchedAt < CONFIG_TTL_MS;

async function fetchConfig(): Promise<void> {
  const key = process.env.INTERNAL_SERVICE_KEY;

  if (!key) {
    // Without the shared secret the resolve endpoint is unreachable; env
    // defaults are the intended behaviour, so don't log this per-request.
    return;
  }

  const res = await axios.get(
    `${env.authServiceUrl}/user/markup/config/resolve`,
    {
      params: { serviceType: SERVICE_TYPE },
      headers: { "x-internal-key": key },
      timeout: CONFIG_TIMEOUT_MS,
    },
  );

  if (!res.data?.success) {
    throw new Error("resolve returned success=false");
  }

  const data = res.data.data || {};

  snapshot = {
    // null means the master has never configured this scope — fall back to
    // env rather than treating "unconfigured" as "off".
    platform: data.platform ?? envPlatformMarkup(),
    b2c: data.b2c ?? envB2cMarkup(),
  };
  fetchedAt = Date.now();
}

/**
 * Refresh the snapshot if stale. Never throws: a config fetch must not be able
 * to fail a search.
 */
export async function refreshMarkupConfig(): Promise<MarkupConfigSnapshot> {
  if (isFresh()) return snapshot;

  if (!inFlight) {
    inFlight = fetchConfig()
      .catch((err: any) => {
        // Keep serving the last known good snapshot (or env). Do NOT advance
        // fetchedAt, so the next request retries rather than caching a failure.
        console.warn(
          `[markup-config] resolve failed, serving ${
            fetchedAt > 0 ? "stale config" : "env defaults"
          }: ${err?.message ?? err}`,
        );
      })
      .finally(() => {
        inFlight = null;
      });
  }

  await inFlight;
  return snapshot;
}

/** Sync read of the current snapshot, for the hot pricing path. */
export function getMarkupConfig(): MarkupConfigSnapshot {
  return snapshot;
}

/** Test seam — resets the module back to env defaults. */
export function __resetMarkupConfigForTests(): void {
  snapshot = { platform: envPlatformMarkup(), b2c: envB2cMarkup() };
  fetchedAt = 0;
  inFlight = null;
}
