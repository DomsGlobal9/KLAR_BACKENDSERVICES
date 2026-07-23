import { hotelsService } from "../services/hotels.service";
import { env } from "../config/env";
import { UnifiedSearchRequest } from "../types/unified";

/**
 * Search cache warmer.
 *
 * A cold hotel search costs a full supplier round-trip; a warm one is a cache
 * read. The single biggest lever on how fast search *feels* is therefore what
 * fraction of real searches land on an already-built master list — so this walks
 * the busiest destination/date combinations on a timer and pays that cost before
 * any user arrives.
 *
 * It spends supplier quota, so it is opt-in (ENABLE_SEARCH_WARMUP=true) and
 * deliberately unhurried: one search at a time with a gap between them, never a
 * burst that looks like abuse to TripJack's WAF.
 */

/** The date windows people actually search, relative to today. */
const DATE_WINDOWS: Array<{ label: string; offsetDays: number; nights: number }> = [
  { label: "tonight", offsetDays: 0, nights: 1 },
  { label: "tomorrow", offsetDays: 1, nights: 1 },
  { label: "next weekend", offsetDays: 7, nights: 2 },
];

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function buildWarmPayload(
  destination: string,
  window: (typeof DATE_WINDOWS)[number],
): UnifiedSearchRequest {
  return {
    destination,
    checkin: isoDate(window.offsetDays),
    checkout: isoDate(window.offsetDays + window.nights),
    // Must match what the frontend sends, or the warmed key is one no real
    // search will ever look up. Two adults, one room is the default the search
    // form opens with.
    rooms: [{ adults: 2, children: 0, childAges: [] }],
    currency: "INR",
    countryCode: "IN",
  } as UnifiedSearchRequest;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let running = false;

async function runWarmupPass(): Promise<void> {
  // A pass can outlast its own interval on a slow supplier day; skip rather than
  // overlap and double the load.
  if (running) {
    console.log("[Warmer] previous pass still running — skipping this tick");
    return;
  }
  running = true;

  const started = Date.now();
  let warmed = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (const destination of env.warmupDestinations) {
      for (const window of DATE_WINDOWS) {
        try {
          const result = await hotelsService.warmMaster(
            buildWarmPayload(destination, window),
            "B2C",
          );
          if (result.warmed) {
            warmed++;
            console.log(
              `[Warmer] ${destination} / ${window.label}: ${result.hotels} hotels`,
            );
          } else {
            skipped++;
          }
        } catch (err: any) {
          failed++;
          console.warn(
            `[Warmer] ${destination} / ${window.label} failed: ${err?.message}`,
          );
        }
        await sleep(env.warmupGapMs);
      }
    }
  } finally {
    running = false;
    console.log(
      `[Warmer] pass complete in ${Math.round((Date.now() - started) / 1000)}s — ` +
        `${warmed} warmed, ${skipped} already fresh, ${failed} failed`,
    );
  }
}

export function startSearchWarmer(): void {
  if (!env.enableSearchWarmup) {
    console.log(
      "ℹ️  Search cache warmer disabled (set ENABLE_SEARCH_WARMUP=true to enable).",
    );
    return;
  }

  const intervalMs = Math.max(1, env.warmupIntervalMin) * 60_000;
  console.log(
    `🔥 Search cache warmer enabled: ${env.warmupDestinations.length} destinations ` +
      `× ${DATE_WINDOWS.length} date windows every ${env.warmupIntervalMin}min`,
  );

  // Let the process finish booting (Mongo indexes, suggestion index) before
  // adding supplier traffic.
  setTimeout(() => {
    void runWarmupPass();
    setInterval(() => void runWarmupPass(), intervalMs).unref();
  }, 30_000).unref();
}
