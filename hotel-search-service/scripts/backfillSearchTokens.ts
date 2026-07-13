/**
 * Fill in Hotel.searchTokens now, at full speed, instead of waiting for the
 * throttled maintenance pass that runs on server boot.
 *
 *   npm run backfill:tokens
 *
 * Safe to re-run and safe to interrupt: it only touches hotels that still lack
 * tokens, and resumes from where it stopped.
 */
import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"], override: true });

import mongoose from "mongoose";
import { connectDB } from "../src/config/db";
import {
  repairUnicodeTokens,
  runSearchTokenMaintenance,
} from "../src/sync/hotelSearchTokensBackfill";

(async () => {
  await connectDB();
  // No pause between batches: this is a deliberate, foreground migration.
  await runSearchTokenMaintenance({ batchSize: 20000, pauseMs: 0 });
  // Rows tokenized before accents were handled correctly still hold broken
  // tokens. The pass above cannot see them — they are not missing tokens, just
  // wrong ones — so repair them here, where a full scan is acceptable.
  await repairUnicodeTokens();
  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error("❌ Backfill failed:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
