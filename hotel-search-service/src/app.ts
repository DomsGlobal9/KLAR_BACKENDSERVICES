import express from "express";
import cors from "cors";
import routes from "./routes";
import { errorHandler } from "./middlewares/error.middleware";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
    res.status(200).json({
        service: "hotel-search-service",
        status: "UP",
        endpoints: {
            destinations: "GET /api/search/destinations",
            hotelSearch: "POST /api/search/hotels/search",
            products: "POST /api/search/hotels/:propertyId/products",
            health: "GET /api/search/health"
        }
    });
});

app.use("/api/search", routes);
app.use(errorHandler);

export default app;
