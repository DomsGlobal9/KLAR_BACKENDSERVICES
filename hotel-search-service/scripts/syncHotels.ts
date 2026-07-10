/**
 * Run the TripJack hotel sync on its own, without restarting the API server.
 *
 *   npm run sync:hotels                 # resume an interrupted run
 *   FULL_RESYNC=true npm run sync:hotels  # scheduled full refresh
 *
 * Intended for a cron entry. The API keeps serving traffic while this runs; the
 * sync only writes to the `hotels` collection.
 */
import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"], override: true });

import mongoose from "mongoose";
import { connectDB } from "../src/config/db";
import { syncTJHotels } from "../src/sync/tjHotelSync";
import { ensureAutocompleteIndex } from "../src/sync/hotelSearchTokensBackfill";

(async () => {
  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB is not connected — refusing to run the sync.");
  }

  // The sync writes searchTokens on every upsert; make sure the index they feed
  // exists before ~1.5M of them land.
  await ensureAutocompleteIndex();

  const startedAt = Date.now();
  await syncTJHotels();
  console.log(`[Sync] Finished in ${((Date.now() - startedAt) / 60000).toFixed(1)} minutes.`);

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error("❌ Hotel sync failed:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
