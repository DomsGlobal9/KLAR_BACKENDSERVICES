import { HotelModel } from "../models/Hotel.model";

export async function runMigrations() {
  console.log("⏳ Checking for database migrations...");
  try {
    const count = await HotelModel.countDocuments({ clientType: { $exists: false } });
    if (count > 0) {
      console.log(`[Migration] Found ${count} hotels without clientType. Migrating to default 'b2c'...`);
      const result = await HotelModel.updateMany(
        { clientType: { $exists: false } },
        { $set: { clientType: "b2c" } }
      );
      console.log(`✅ [Migration] Successfully updated ${result.modifiedCount} hotels.`);
    } else {
      console.log("✅ [Migration] No pending migrations.");
    }
  } catch (err: any) {
    console.error("❌ [Migration] Error running migration:", err.message);
  }
}
