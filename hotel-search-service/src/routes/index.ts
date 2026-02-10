import { Router } from "express";
import { getDestinations } from "../controllers/destinations.controller";
import { searchHotels } from "../controllers/hotels.controller";
import { getProducts } from "../controllers/products.controller";

const router = Router();

// Base route returns destinations data as requested
router.get("/", getDestinations);

router.get("/health", (_req, res) => {
  res.json({
    status: "UP",
    service: "hotel-search-service"
  });
});

router.get("/destinations", getDestinations);
router.post("/hotels/search", searchHotels);
router.post("/hotels/:propertyId/products", getProducts);

export default router;
