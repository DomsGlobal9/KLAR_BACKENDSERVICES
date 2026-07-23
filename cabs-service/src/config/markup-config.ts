/**
 * Master-owned markup configuration for cabs, resolved from auth-service.
 *
 * Mirrors hotel-booking-service/src/config/markup-config.ts — same cache shape,
 * same degradation order, same failure semantics — differing only in
 * SERVICE_TYPE. Cabs previously had no markup configuration at all: the margin
 * was whatever the client put in `pricingInfo.agentMarkup`.
 *
 * FAILURE SEMANTICS
 * -----------------
 * This value is money. Returning 0 because auth-service blinked means selling
 * at supplier net — a silent, unbounded loss nobody downstream reports, because
 * the platform markup is invisible to agents by design. So we degrade:
 *
 *   fresh cache  ->  live fetch  ->  STALE cache  ->  env defaults
 *
 * A rule the master has explicitly saved with `enabled: false` is a decision,
 * not a failure, and does yield zero. auth-service distinguishes "never
 * configured" (null -> env fallback) from "configured off".
 */

import axios from "axios";

import { env } from "./env";
import { MarkupRegion } from "../utils/region.util";

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
const SERVICE_TYPE = "CABS";

const envPlatformMarkup = (): ResolvedMarkup => ({
  enabled: (process.env.CAB_PLATFORM_MARKUP_ENABLED || "false") === "true",
  type:
    (process.env.CAB_PLATFORM_MARKUP_TYPE || "FIXED").toUpperCase() ===
    "PERCENTAGE"
      ? "PERCENTAGE"
      : "FIXED",
  value: Number(process.env.CAB_PLATFORM_MARKUP_VALUE || 0),
});

const envB2cMarkup = (): ResolvedMarkup => ({
  enabled: (process.env.CAB_B2C_MARKUP_ENABLED || "false") === "true",
  type:
    (process.env.CAB_B2C_MARKUP_TYPE || "FIXED").toUpperCase() === "PERCENTAGE"
      ? "PERCENTAGE"
      : "FIXED",
  value: Number(process.env.CAB_B2C_MARKUP_VALUE || 0),
});

const envSnapshot = (): MarkupConfigSnapshot => ({
  platform: envPlatformMarkup(),
  b2c: envB2cMarkup(),
});

/**
 * One snapshot PER REGION, not a single "current region" module variable: that
 * would be overwritten by whatever request interleaved during a supplier await.
 */
const snapshots = new Map<MarkupRegion, MarkupConfigSnapshot>();
const fetchedAt = new Map<MarkupRegion, number>();
const inFlight = new Map<MarkupRegion, Promise<void>>();

const isFresh = (region: MarkupRegion) => {
  const at = fetchedAt.get(region) ?? 0;
  return at > 0 && Date.now() - at < CONFIG_TTL_MS;
};

async function fetchConfig(region: MarkupRegion): Promise<void> {
  const key = process.env.INTERNAL_SERVICE_KEY;
  if (!key) return;

  const res = await axios.get(
    `${env.authServiceUrl}/user/markup/config/resolve`,
    {
      // auth-service applies exact-region-then-ALL, so this is already the
      // effective rule for the region.
      params: { serviceType: SERVICE_TYPE, region },
      headers: { "x-internal-key": key },
      timeout: CONFIG_TIMEOUT_MS,
    },
  );

  if (!res.data?.success) {
    throw new Error("resolve returned success=false");
  }

  const data = res.data.data || {};

  snapshots.set(region, {
    // null means never configured — fall back to env rather than treating
    // "unconfigured" as "off".
    platform: data.platform ?? envPlatformMarkup(),
    b2c: data.b2c ?? envB2cMarkup(),
  });
  fetchedAt.set(region, Date.now());
}

/** Refresh the snapshot for `region` if stale. Never throws. */
export async function refreshMarkupConfig(
  region: MarkupRegion = "ALL",
): Promise<MarkupConfigSnapshot> {
  if (isFresh(region)) return getMarkupConfig(region);

  if (!inFlight.has(region)) {
    const p = fetchConfig(region)
      .catch((err: any) => {
        console.warn(
          `[markup-config] resolve failed for region=${region}, serving ${
            snapshots.has(region) ? "stale config" : "env defaults"
          }: ${err?.message ?? err}`,
        );
      })
      .finally(() => {
        inFlight.delete(region);
      });
    inFlight.set(region, p);
  }

  await inFlight.get(region);
  return getMarkupConfig(region);
}

/** Sync read. Degrades region -> ALL -> env defaults, never to zero. */
export function getMarkupConfig(
  region: MarkupRegion = "ALL",
): MarkupConfigSnapshot {
  return snapshots.get(region) ?? snapshots.get("ALL") ?? envSnapshot();
}

/** Test seam — resets the module back to env defaults. */
export function __resetMarkupConfigForTests(): void {
  snapshots.clear();
  fetchedAt.clear();
  inFlight.clear();
}

/** Test seam — seeds a region's snapshot without a network call. */
export function __setMarkupConfigForTests(
  region: MarkupRegion,
  snapshot: MarkupConfigSnapshot,
): void {
  snapshots.set(region, snapshot);
  fetchedAt.set(region, Date.now());
}
