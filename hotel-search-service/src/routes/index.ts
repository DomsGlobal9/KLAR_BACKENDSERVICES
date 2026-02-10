import { Router } from "express";
import { getDestinations } from "../controllers/destinations.controller";
import { searchHotels } from "../controllers/hotels.controller";
import { getProducts } from "../controllers/products.controller";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    message: "Hotel Search Service API",
    endpoints: {
      health: "/health",
      destinations: "/destinations",
      search: "/hotels/search (POST)",
      products: "/hotels/:propertyId/products (POST)"
    }
  });
});

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
