import { rateGainProvider } from "../providers/rategain.provider";
import { RGDestinationModel } from "../models/RGDestination.model";

export async function syncRGDestinations(force = false) {
  // Optimization: Skip sync if we already have destinations unless forced
  const existingCount = await RGDestinationModel.countDocuments();
  if (existingCount > 0 && !force) {
    console.log(
      `[Sync] Skip RateGain Destinations Sync: DB already has ${existingCount} destinations. Use force=true to refresh.`,
    );
    return;
  }

  console.log(
    `[Sync] Starting RateGain Destinations Sync (Force: ${force})...`,
  );
  try {
    const data = await rateGainProvider.getDestinations();
    const destinations = data.body || data.destinations || [];

    if (destinations.length === 0) {
      console.log("[Sync] No RG destinations received.");
      return;
    }

    const bulkOps = [];
    for (const dest of destinations) {
      if (dest.destName && dest.destCode) {
        bulkOps.push({
          updateOne: {
            filter: { destCode: dest.destCode },
            update: {
              $set: {
                destName: dest.destName.toLowerCase().trim(),
              },
            },
            upsert: true,
          },
        });
      }
    }

    if (bulkOps.length > 0) {
      await RGDestinationModel.bulkWrite(bulkOps, { ordered: false });
    }

    const dbCount = await RGDestinationModel.countDocuments();
    console.log(
      `[Sync] RateGain Destinations Sync Complete. DB has ${dbCount} destinations.`,
    );
  } catch (error: any) {
    console.error("[Sync] RateGain Sync Failed:", error.message);
  }
}
