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

let snapshot: MarkupConfigSnapshot = {
  platform: envPlatformMarkup(),
  b2c: envB2cMarkup(),
};

let fetchedAt = 0;
let inFlight: Promise<void> | null = null;

const isFresh = () => fetchedAt > 0 && Date.now() - fetchedAt < CONFIG_TTL_MS;

async function fetchConfig(): Promise<void> {
  const key = process.env.INTERNAL_SERVICE_KEY;
  if (!key) return;

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
    platform: data.platform ?? envPlatformMarkup(),
    b2c: data.b2c ?? envB2cMarkup(),
  };
  fetchedAt = Date.now();
}

/** Refresh the snapshot if stale. Never throws. */
export async function refreshMarkupConfig(): Promise<MarkupConfigSnapshot> {
  if (isFresh()) return snapshot;

  if (!inFlight) {
    inFlight = fetchConfig()
      .catch((err: any) => {
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
