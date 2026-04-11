import { Router } from "express";
import { getDestinations } from "../controllers/destinations.controller";
import { searchHotels, getHotelSuggestions } from "../controllers/hotels.controller";
import { getProducts } from "../controllers/products.controller";
import { HotelModel } from "../models/Hotel.model";
import { RGDestinationModel } from "../models/RGDestination.model";
import { resolveForTJ, resolveForRG } from "../services/destinationResolver";
import { syncTJHotels } from "../sync/tjHotelSync";
import { syncRGDestinations } from "../sync/rgDestinationSync";

const router = Router();

router.post("/sync/destinations", async (_req, res) => {
    res.json({ status: "started", message: "RateGain destination sync triggered in background" });
    syncRGDestinations().catch((err) =>
        console.error("[Sync] Manual RG sync failed:", err.message)
    );
});

// ─── Core Routes ─────────────────────────────────────────────────────────────

// Base route returns destinations data as requested
router.get("/", getDestinations);

router.get("/health", (_req, res) => {
    res.json({
        status: "UP",
        service: "hotel-search-service",
    });
});

router.get("/destinations", getDestinations);
router.get("/hotels/suggestions", getHotelSuggestions);
router.post("/hotels/search", searchHotels);
router.post("/", searchHotels); // Unified architecture POST /api/search
router.post("/hotels/:propertyId/products", getProducts);

export default router;
