import { Router } from "express";
import {
  getDestinations,
  getPopularDestinations,
  getCountryCities,
} from "../controllers/destinations.controller";
import {
  searchHotels,
  getHotelSuggestions,
  getPopularAreas,
  getStaticHotels,
} from "../controllers/hotels.controller";
import { getProducts } from "../controllers/products.controller";
import { HotelModel } from "../models/Hotel.model";
import { RGDestinationModel } from "../models/RGDestination.model";
import { resolveForTJ, resolveForRG } from "../services/destinationResolver";
import { syncTJHotels } from "../sync/tjHotelSync";
import { syncRGDestinations } from "../sync/rgDestinationSync";

import geoRouter from "./geo.routes";

const router = Router();

router.use("/geo", geoRouter);

router.post("/sync/destinations", async (req, res) => {
  const force = req.query.force === "true";
  res.json({
    status: "started",
    message: `RateGain destination sync triggered (force: ${force})`,
  });
  syncRGDestinations(force).catch((err) =>
    console.error("[Sync] Manual RG sync failed:", err.message),
  );
});

router.post("/sync/hotels", async (_req, res) => {
  res.json({
    status: "started",
    message: "TripJack hotel sync triggered in background",
  });
  syncTJHotels().catch((err) =>
    console.error("[Sync] Manual TJ sync failed:", err.message),
  );
});

// ─── Core Routes ─────────────────────────────────────────────────────────────

// Base route returns destinations data as requested
// router.get("/", getDestinations);

router.get("/health", (_req, res) => {
  res.json({
    status: "UP",
    service: "hotel-search-service",
  });
});

router.get("/destinations", getDestinations);
router.get("/destinations/popular", getPopularDestinations);
router.get("/destinations/cities", getCountryCities);
router.get("/hotels/suggestions", getHotelSuggestions);
router.get("/hotels/popular-areas", getPopularAreas);
router.get("/hotels/static", getStaticHotels);
router.post("/hotels/search", searchHotels);
router.post("/", searchHotels); // Unified architecture POST /api/search
router.post("/hotels/:propertyId/products", getProducts);

export default router;
