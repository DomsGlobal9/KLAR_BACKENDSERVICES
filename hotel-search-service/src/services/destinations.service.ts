import { RGDestinationModel } from "../models/RGDestination.model";
import { isMongoReady } from "../utils/mongoReady";

class DestinationsService {
  async getDestinations() {
    // Use MongoDB aggregation to deduplicate by destName (case-insensitive) at the database level
    const uniqueDestinations = await RGDestinationModel.aggregate([
      {
        $group: {
          _id: {
            $toLower: {
              $trim: {
                input: {
                  $arrayElemAt: [{ $split: ["$destName", ","] }, 0],
                },
              },
            },
          },
          destCode: { $first: "$destCode" },
          destName: { $first: "$destName" },
          countryName: { $first: "$countryName" },
        },
      },
    ]);

    return {
      status: true,
      body: uniqueDestinations.map((dest) => ({
        destCode: dest.destCode,
        destName: dest.destName,
        countryName: dest.countryName || "", // Optional
      })),
    };
  }

  async getPopularDestinations() {
    // Without this, a disconnected Mongo buffers the query for 10s before
    // rejecting, stalling the dropdown's empty state on every page load.
    if (!isMongoReady()) {
      console.warn("[Destinations] MongoDB not connected — returning no popular destinations.");
      return { status: true, body: [] };
    }

    try {
      const popularNames = [
        "Jaipur",
        "Delhi",
        "Goa",
        "Kerala",
        "Hyderabad",
        "Mumbai",
        "Chennai",
      ];

      // Use a case-insensitive regex to match these specific destinations
      // We'll also try to fetch the shortest `destCode` for each to avoid redundant variations
      const regexPatterns = popularNames.map(
        (name) => new RegExp(`^${name}`, "i"),
      );

      const destinations = await RGDestinationModel.find({
        destName: { $in: regexPatterns },
      }).lean();

      // Deduplicate and prioritize exact matches or shortest names
      const uniqueDestinationsMap = new Map();

      for (const dest of destinations) {
        // Find which popular name it matches
        const matchedName = popularNames.find((name) =>
          dest.destName.toLowerCase().startsWith(name.toLowerCase()),
        );

        if (matchedName) {
          // If we already have one, keep the one with the shorter name (usually the primary one)
          if (
            !uniqueDestinationsMap.has(matchedName) ||
            dest.destName.length <
              uniqueDestinationsMap.get(matchedName).destName.length
          ) {
            uniqueDestinationsMap.set(matchedName, dest);
          }
        }
      }

      // If some are missing (e.g. 'New Delhi' instead of 'Delhi'), we can do a fallback
      for (const name of popularNames) {
        if (!uniqueDestinationsMap.has(name)) {
          const fallbackMatch = await RGDestinationModel.findOne({
            destName: new RegExp(name, "i"), // broader match
          }).lean();
          if (fallbackMatch) uniqueDestinationsMap.set(name, fallbackMatch);
        }
      }

      const finalDestinations = Array.from(uniqueDestinationsMap.values());

      return {
        status: true,
        body: finalDestinations.map((dest) => {
          const rawName = dest.destName.split(",")[0];
          const cleanName = rawName.replace(/\s+india$/i, "").trim();
          return {
            id: dest.destCode,
            name: cleanName,
            type: "popular",
            city: cleanName,
          };
        }),
      };
    } catch (error: any) {
      console.error(
        "❌ [DestinationsService] Failed to fetch popular destinations:",
        error.message,
      );
      return {
        status: true,
        body: [], // Return empty list on failure instead of 500
      };
    }
  }
}

export const destinationsService = new DestinationsService();
