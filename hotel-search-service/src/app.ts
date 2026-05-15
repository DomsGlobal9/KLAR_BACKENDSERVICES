import express from "express";
import cors from "cors";
import routes from "./routes";
import { errorHandler } from "./middlewares/error.middleware";

const app = express();

app.use(cors({
    origin: true,
    credentials: true,
}));
app.use(express.json());

app.get("/", (_req, res) => {
    res.status(200).json({
        service: "hotel-search-service",
        status: "UP",
        endpoints: {
            destinations: "GET /api/search/destinations",
            popularDestinations: "GET /api/search/destinations/popular",
            hotelSearch: "POST /api/search/hotels/search",
            products: "POST /api/search/hotels/:propertyId/products",
            health: "GET /api/search/health",
            syncHotels: "POST /api/search/sync/hotels",
            syncDestinations: "POST /api/search/sync/destinations",
        }
    });
});

app.use("/api/search", routes);
// app.use("/", routes);
app.use(errorHandler);

export default app;
