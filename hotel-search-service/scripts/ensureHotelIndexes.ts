/**
 * Creates the Hotel collection's indexes.
 *
 * `mongoose.set("autoIndex", false)` in config/db.ts means indexes declared on
 * the schema are never built by the running service — deliberately, so a boot
 * never triggers a foreground build against 1.6M documents. They therefore have
 * to be created out of band, which is what this script is for.
 *
 * Safe to re-run: creating an index that already exists is a no-op. Builds run
 * in the background, so the service keeps serving while it works.
 *
 *   npm run ensure:indexes
 */
import { connectDB } from "../src/config/db";
import { HotelModel } from "../src/models/Hotel.model";
import mongoose from "mongoose";

async function main() {
  await connectDB();

  const specs: Array<{ name: string; keys: Record<string, any> }> = [
    // Backs the "top cities in <country>" aggregation behind the landing-page
    // destination tiles. Without it that group-by scans the whole collection and
    // blows its time budget, which shows up as empty tiles.
    { name: "countryName_1_cityName_1", keys: { countryName: 1, cityName: 1 } },
    { name: "searchTokens_1", keys: { searchTokens: 1 } },
    { name: "cityName_1", keys: { cityName: 1 } },
  ];

  for (const spec of specs) {
    const startedAt = Date.now();
    process.stdout.write(`Creating ${spec.name} … `);
    await HotelModel.collection.createIndex(spec.keys, {
      name: spec.name,
      background: true,
    });
    console.log(`done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  }

  console.log("\nAll indexes present.");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Index creation failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
