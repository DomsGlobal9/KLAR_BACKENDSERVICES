/**
 * Master-owned markup configuration, resolved from auth-service.
 *
 * MUST stay behaviourally identical to hotel-search-service's copy of this
 * module. The two services independently compute the platform markup baked
 * into the same price: search decides what the agent is quoted, booking
 * re-derives it to validate the quote against a fresh supplier precheck. If
 * they ever disagree by more than the ValidationEngine's tolerance
 * (fixed: 10 / percent: 0.5), every booking fails as PRICE_CHANGED — and the
 * failure looks like a supplier problem, not a config problem.
 *
 * The duplication is deliberate: these are separately deployed services with
 * no shared package. Any change here must be mirrored there.
 *
 * See that file for the snapshot rationale and failure semantics
 * (fresh -> live -> stale -> env, never zero-by-accident).
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
const SERVICE_TYPE = "HOTEL";

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

const envSnapshot = (): MarkupConfigSnapshot => ({
  platform: envPlatformMarkup(),
  b2c: envB2cMarkup(),
});

/**
 * One snapshot PER REGION. Mirrors hotel-search-service's cache deliberately:
 * a single "current region" module variable would be overwritten by whatever
 * request interleaved during a supplier await, and search and commit would then
 * price the same stay differently.
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

/**
 * Sync read for the hot pricing path. Degrades region -> ALL -> env defaults,
 * never to zero: pricing at supplier net because a region was never fetched is
 * a silent, unbounded loss.
 */
export function getMarkupConfig(
  region: MarkupRegion = "ALL",
): MarkupConfigSnapshot {
  return snapshots.get(region) ?? snapshots.get("ALL") ?? envSnapshot();
}
