import { Router } from "express";
import { GeoCacheModel } from "../models/GeoCache.model";
import { resolveCityToCoords } from "../services/destinationResolver";

const router = Router();

router.post("/update", async (req, res) => {
  try {
    const { query, lat, lng, radiusKm, boundingBox } = req.body;
    if (!query || lat == null || lng == null || radiusKm == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const normalizedQuery = query.toLowerCase().trim();
    const bbox = boundingBox || [
      (lat - 0.2).toString(),
      (lat + 0.2).toString(),
      (lng - 0.2).toString(),
      (lng + 0.2).toString(),
    ];
    const updated = await GeoCacheModel.findOneAndUpdate(
      { query: normalizedQuery },
      { lat, lng, radiusKm, boundingBox: bbox },
      { upsert: true, new: true },
    );
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/bulk-seed", async (req, res) => {
  try {
    const { cities } = req.body;
    if (!Array.isArray(cities)) {
      return res
        .status(400)
        .json({ error: "cities must be an array of strings" });
    }
    const results = [];
    for (const city of cities) {
      // resolveCityToCoords will geocode and save to cache automatically if not present
      const resolved = await resolveCityToCoords(city);
      results.push({ city, resolved });
      await new Promise((r) => setTimeout(r, 1200)); // Rate limit safety delay
    }
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
