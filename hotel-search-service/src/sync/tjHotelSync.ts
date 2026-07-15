import axios from "axios";
import { HotelModel, buildSearchTokens } from "../models/Hotel.model";
import { tripJackClient } from "../clients/tripjack.client";
import { env } from "../config/env";
import fs from "fs/promises";
import path from "path";

import { NationalityModel } from "../models/Nationality.model";

const TJ_STATIC_BASE_URL = "https://api.tripjack.com";

const tripJackStaticClient = axios.create({
  baseURL: TJ_STATIC_BASE_URL,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    apikey: env.tripJack.apiKey,
    agencyId: env.tripJack.agencyId,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
});

const PROGRESS_FILE = path.join(process.cwd(), "sync_progress_tj_hotels.json");

async function saveProgress(token: string, totalSynced: number) {
  try {
    await fs.writeFile(
      PROGRESS_FILE,
      JSON.stringify({ token, totalSynced, updatedAt: new Date() }, null, 2),
    );
  } catch (err: any) {
    console.error(`[Sync] Failed to save progress: ${err.message}`);
  }
}

async function loadProgress() {
  try {
    const data = await fs.readFile(PROGRESS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Removes the resume token so the next run starts from the first page.
 *
 * Without this a completed sync leaves its last token behind, and every later
 * run resumes from there — permanently skipping every hotel before that point.
 * A weekly refresh then never refreshes the bulk of the catalogue.
 */
async function clearProgress() {
  try {
    await fs.unlink(PROGRESS_FILE);
    console.log("[Sync] Progress file cleared — the next run starts from the beginning.");
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      console.error(`[Sync] Failed to clear progress file: ${err.message}`);
    }
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function syncTJHotels() {
  console.log("[Sync] Initializing TripJack Hotels Sync...");

  // A periodic refresh must revisit every hotel, otherwise prices, names and
  // withdrawals before the resume point go stale forever. Set FULL_RESYNC=true
  // for the scheduled run; leave it unset so a crashed run can pick up where it
  // stopped.
  const fullResync = process.env.FULL_RESYNC === "true";
  if (fullResync) {
    console.log("[Sync] FULL_RESYNC=true — ignoring any saved progress.");
    await clearProgress();
  }

  const progress = fullResync ? null : await loadProgress();
  let nextToken: string | undefined = progress?.token;
  let totalCount = progress?.totalSynced || 0;
  let pageCount = 0;
  let hasNext = true;

  if (nextToken) {
    const ageDays = progress?.updatedAt
      ? (Date.now() - new Date(progress.updatedAt).getTime()) / DAY_MS
      : null;

    console.log(
      `[Sync] Resuming from saved token (${totalCount} hotels already synced` +
        (ageDays === null ? "" : `, saved ${ageDays.toFixed(1)} days ago`) +
        ").",
    );

    if (ageDays !== null && ageDays > 1) {
      console.warn(
        `⚠️  [Sync] This token is ${ageDays.toFixed(1)} days old. Hotels before it will NOT be ` +
          `refreshed. Run with FULL_RESYNC=true for a complete refresh.`,
      );
    }
  } else {
    // estimatedDocumentCount reads collection metadata; countDocuments() would
    // scan all ~1.5M documents just to print this line.
    const dbCount = await HotelModel.estimatedDocumentCount();
    console.log(`[Sync] Starting from the first page. DB currently holds ${dbCount} hotels.`);
  }

  const startTime = Date.now();
  let lastLogTime = Date.now();
  let hotelsSinceLastLog = 0;

  // Concurrency control for DB writes
  const pendingWrites: Promise<any>[] = [];
  const MAX_CONCURRENT_WRITES = 5;

  try {
    while (hasNext) {
      const payload: any = {
        next: nextToken || undefined,
        pageSize: 1000, // Maximize page size
      };

      // 1. Fetch next page (Wait for network)
      let res: any;
      let retryCount = 0;
      const maxRetries = 5;

      while (retryCount < maxRetries) {
        try {
          res = await tripJackStaticClient.post(
            "/hms/v3/fetch-static-hotels",
            payload,
          );

          break;
        } catch (err: any) {
          retryCount++;
          const status = err.response?.status;
          const delay = Math.min(retryCount * 5000, 30000);
          console.warn(
            `[Sync] TripJack API Error ${status || err.message} (Attempt ${retryCount}/${maxRetries}). Retrying in ${delay / 1000}s...`,
          );
          await new Promise((r) => setTimeout(r, delay));
          if (retryCount === maxRetries) throw err;
        }
      }

      const data = res.data;
      const hotels = data.hotelOpInfos || data.hotels || [];

      if (hotels.length === 0) {
        console.log("[Sync] No more hotels found. Sync complete.");
        hasNext = false;
        break;
      }

      pageCount++;
      nextToken = data.next;

      // 2. Map hotels to bulk operations
      const bulkOps = hotels
        .filter((h: any) => !h.isDeleted && h.tjHotelId)
        .map((hotel: any) => {
          const lat = parseFloat(hotel.geolocation?.lt) || 0;
          const lng = parseFloat(hotel.geolocation?.ln) || 0;
          const cityName = (hotel.address?.city?.name || hotel.cityName || "")
            .toLowerCase()
            .trim();
          const addressStr = hotel.address?.adr || hotel.address || "";
          const imageUrls = Array.isArray(hotel.images)
            ? hotel.images
                .map((img: any) => (typeof img === "string" ? img : img.url))
                .filter(Boolean)
            : [];

          return {
            updateOne: {
              filter: { tjHotelId: String(hotel.tjHotelId) },
              update: {
                $set: {
                  name: hotel.name || "",
                  cityName,
                  searchTokens: buildSearchTokens(hotel.name || "", cityName),
                  countryName:
                    hotel.address?.country?.name || hotel.countryName || "",
                  starRating:
                    parseInt(hotel.rating) || parseInt(hotel.starCategory) || 0,
                  address: addressStr,
                  accTypeDesc: hotel.accTypeDesc || "",
                  accMultiDesc: hotel.accMultiDesc || "",
                  accomodationType: hotel.accomodationType || "",
                  location: { type: "Point", coordinates: [lng, lat] },
                  images: imageUrls,
                  lastUpdated: new Date(),
                },
              },
              upsert: true,
            },
          };
        });

      // 3. Save to DB (Fire and partial forget with concurrency limit)
      if (bulkOps.length > 0) {
        const writePromise = HotelModel.bulkWrite(bulkOps, { ordered: false })
          .then(() => {
            totalCount += bulkOps.length;
            hotelsSinceLastLog += bulkOps.length;
          })
          .catch((err) =>
            console.error(`[Sync] DB Write Error: ${err.message}`),
          );

        pendingWrites.push(writePromise);

        // Wait if we have too many pending writes
        if (pendingWrites.length >= MAX_CONCURRENT_WRITES) {
          await Promise.race(pendingWrites);
          // Remove resolved promises
          for (let i = pendingWrites.length - 1; i >= 0; i--) {
            // This is a bit crude but works to keep the array lean
            // @ts-ignore
            if (pendingWrites[i].status !== "pending") {
              // Filter doesn't work well with Promise array without checking status
            }
          }
          // Clean up array
          while (pendingWrites.length >= MAX_CONCURRENT_WRITES) {
            await pendingWrites.shift();
          }
        }
      }

      // 4. Periodically save progress and log stats
      const now = Date.now();
      if (now - lastLogTime > 10000) {
        // Every 10 seconds
        const elapsedTotal = (now - startTime) / 1000;
        const speed = hotelsSinceLastLog / ((now - lastLogTime) / 1000);
        const avgSpeed = totalCount / elapsedTotal;

        console.log(
          `[Sync] Page ${pageCount} | Total: ${totalCount} | Current Speed: ${speed.toFixed(1)} h/s | Avg: ${avgSpeed.toFixed(1)} h/s`,
        );

        if (nextToken) {
          await saveProgress(nextToken, totalCount);
        }

        lastLogTime = now;
        hotelsSinceLastLog = 0;
      }

      if (!nextToken) {
        hasNext = false;
      } else {
        // Small sleep to be polite, but much shorter
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    // Wait for final writes
    await Promise.all(pendingWrites);

    // The loop only exits when TripJack runs out of pages, so reaching here means
    // the catalogue was walked end to end. Drop the resume token: keeping it would
    // make the next run skip everything before it.
    await clearProgress();

    console.log(
      `[Sync] Success! Finished syncing. Total hotels in DB: ${totalCount}`,
    );
  } catch (error: any) {
    // A crash mid-walk is exactly when the token earns its keep.
    console.error(`[Sync] CRITICAL FAILURE:`, error.message);
    if (nextToken) await saveProgress(nextToken, totalCount);
  }
}

/**
 * Sync Nationalities from TripJack v3
 */
export async function syncTJNationalities() {
  console.log("[Sync] Syncing TripJack Nationalities...");
  try {
    const res = await tripJackStaticClient.get("/hms/v3/nationality-info");

    const data = res.data;
    if (!data.status?.success) {
      console.error(
        "[Sync] Nationalities API returned failure:",
        data.status?.description,
      );
      return;
    }

    const nationalities = data.nationalityInfos || [];
    console.log(`[Sync] Found ${nationalities.length} nationalities.`);

    const bulkOps = nationalities.map((n: any) => ({
      updateOne: {
        filter: { countryId: n.countryId },
        update: {
          $set: {
            countryName: n.countryName,
            dialCode: n.dialCode,
            code: n.code,
            isoCode: n.isoCode,
            updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await NationalityModel.bulkWrite(bulkOps);
      console.log("✅ [Sync] TripJack Nationalities updated in DB.");
    }
  } catch (err: any) {
    if (err.response) {
      console.error(
        "[Sync] Failed to sync nationalities:",
        err.response.status,
        JSON.stringify(err.response.data),
      );
    } else {
      console.error("[Sync] Failed to sync nationalities:", err.message);
    }
  }
}

/**
 * Sync Deleted Hotels from TripJack v3
 */
export async function syncTJDeletedHotels(lastUpdateTime: string) {
  console.log(
    `[Sync] Syncing TripJack Deleted Hotels since ${lastUpdateTime}...`,
  );
  try {
    const res = await tripJackStaticClient.post(
      "/hms/v3/fetch-static-hotels/deleted",
      {
        lastUpdateTime,
      },
    );

    const hotels = res.data.hotelOpInfos || [];
    if (hotels.length > 0) {
      const ids = hotels.map((h: any) => h.tjHotelId);
      await HotelModel.deleteMany({ tjHotelId: { $in: ids } });
      console.log(`✅ [Sync] Removed ${ids.length} deleted hotels from DB.`);
    }
  } catch (err: any) {
    if (err.response) {
      console.error(
        "[Sync] Failed to sync deleted hotels:",
        err.response.status,
        JSON.stringify(err.response.data),
      );
    } else {
      console.error("[Sync] Failed to sync deleted hotels:", err.message);
    }
  }
}
